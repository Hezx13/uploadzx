import { describe, it, expect, vi } from 'vitest';
import { UploadController } from '../src/transport/UploadController';
import type {
  UploadDriver,
  UploadDriverContext,
  UploadDriverHandlers,
  UploadSession,
  ResumeData,
} from '../src/transport/types';
import type { UploadFile } from '../src/types';

/** A driver whose session is fully controllable from the test. */
class FakeSession implements UploadSession {
  pauseCalls = 0;
  private rejectFn?: (e: Error) => void;
  private resolveFn?: () => void;

  constructor(
    private ctx: UploadDriverContext,
    public handlers: UploadDriverHandlers,
    private resumable: boolean
  ) {}

  start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.resolveFn = resolve;
      this.rejectFn = reject;
    });
  }

  async pause(): Promise<void> {
    this.pauseCalls += 1;
    // A resumable driver flushes its checkpoint here.
    if (this.resumable) {
      this.handlers.onCheckpoint({ uploadUrl: 'https://tus.example/u/1' });
    }
  }

  // test helpers
  emitProgress(bytes: number) {
    this.handlers.onProgress(bytes);
  }
  fail(error: Error) {
    this.rejectFn?.(error);
  }
  succeed(url?: string) {
    this.handlers.onSuccess({ url });
    this.resolveFn?.();
  }
}

class FakeDriver implements UploadDriver {
  readonly name = 'fake';
  lastSession?: FakeSession;
  constructor(public readonly resumable: boolean) {}
  createSession(ctx: UploadDriverContext, handlers: UploadDriverHandlers): UploadSession {
    this.lastSession = new FakeSession(ctx, handlers, this.resumable);
    return this.lastSession;
  }
}

function makeFile(size = 1000): UploadFile {
  const file = new File(['x'.repeat(size)], 'f.bin', { type: 'application/octet-stream' });
  return { id: 'id-1', file, name: 'f.bin', size: file.size, type: file.type };
}

const flush = () => new Promise<void>(r => setTimeout(r, 0));

describe('UploadController', () => {
  it('invokes session.pause() and persists the resume checkpoint on pause', async () => {
    const driver = new FakeDriver(true);
    const ctrl = new UploadController(makeFile(), {}, driver);

    void ctrl.start();
    await flush();
    driver.lastSession!.emitProgress(500);

    await ctrl.pause();

    expect(driver.lastSession!.pauseCalls).toBe(1);
    expect(ctrl.getResumeData()).toEqual({ uploadUrl: 'https://tus.example/u/1' });
    expect(ctrl.getState().status).toBe('paused');
  });

  it('reports an error exactly once when the session rejects', async () => {
    const driver = new FakeDriver(true);
    const onError = vi.fn();
    const ctrl = new UploadController(makeFile(), {}, driver, { onError });

    void ctrl.start();
    await flush();
    driver.lastSession!.fail(new Error('boom'));
    await flush();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(ctrl.getState().status).toBe('error');
  });

  it('does not treat a pause-driven abort as an error', async () => {
    const driver = new FakeDriver(true);
    const onError = vi.fn();
    const ctrl = new UploadController(makeFile(), {}, driver, { onError });

    void ctrl.start();
    await flush();
    await ctrl.pause();
    // Simulate the in-flight session rejecting due to the abort.
    driver.lastSession!.fail(new Error('aborted'));
    await flush();

    expect(onError).not.toHaveBeenCalled();
    expect(ctrl.getState().status).toBe('paused');
  });

  it('gates canResume() on the driver capability', async () => {
    const resumable = new UploadController(makeFile(), {}, new FakeDriver(true));
    const oneShot = new UploadController(makeFile(), {}, new FakeDriver(false));

    for (const ctrl of [resumable, oneShot]) {
      void ctrl.start();
      await flush();
      await ctrl.pause();
    }

    expect(resumable.canResume()).toBe(true);
    expect(oneShot.canResume()).toBe(false);
  });

  it('restarts a non-resumable upload from byte 0 on resume', async () => {
    const driver = new FakeDriver(false);
    const ctrl = new UploadController(makeFile(), {}, driver);

    void ctrl.start();
    await flush();
    driver.lastSession!.emitProgress(700);
    await ctrl.pause();
    expect(ctrl.getState().progress.bytesUploaded).toBe(700);

    void ctrl.resume();
    await flush();

    expect(ctrl.getState().progress.bytesUploaded).toBe(0);
    expect(ctrl.getState().status).toBe('uploading');
  });
});
