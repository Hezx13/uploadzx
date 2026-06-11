import { describe, it, expect, vi } from 'vitest';
import { createLogger } from '../src/utils';
import type { UploadDriverContext, UploadDriverHandlers } from '../src/transport/types';

// Capture the options handed to tus's Upload without performing any network I/O.
const { captured } = vi.hoisted(() => ({ captured: [] as any[] }));

vi.mock('tus-js-client', () => {
  class Upload {
    url: string | null = null;
    constructor(
      public file: unknown,
      public options: Record<string, unknown>
    ) {
      captured.push(options);
    }
    start(): void {}
    abort(): void {}
    async findPreviousUploads(): Promise<unknown[]> {
      return [];
    }
  }
  return { Upload, defaultOptions: { fingerprint: async () => 'fp' } };
});

// Imported after the mock is registered.
import { TusDriver } from '../src/transport/TusDriver';

const noopHandlers: UploadDriverHandlers = {
  onProgress: () => {},
  onCheckpoint: () => {},
  onSuccess: () => {},
};

function ctx(overrides: Partial<UploadDriverContext> = {}): UploadDriverContext {
  return {
    fileId: '1',
    file: new File(['x'], 'x.bin', { type: 'application/octet-stream' }),
    name: 'x.bin',
    size: 1,
    type: 'application/octet-stream',
    signal: new AbortController().signal,
    logger: createLogger(false),
    ...overrides,
  };
}

const flush = () => new Promise<void>(r => setTimeout(r, 0));

describe('TusDriver integrity metadata', () => {
  it('maps the integrity digest into checksum metadata', async () => {
    captured.length = 0;
    const driver = new TusDriver({ endpoint: 'https://tus.example/files' });
    const session = driver.createSession(
      ctx({ integrity: { digest: { algorithm: 'blake3', hex: 'abcd' }, metadataKey: 'checksum' } }),
      noopHandlers
    );

    void session.start();
    await flush();

    expect(captured[0].metadata.checksum).toBe('blake3:abcd');
  });

  it('uses a custom metadata key when provided', async () => {
    captured.length = 0;
    const driver = new TusDriver({ endpoint: 'https://tus.example/files' });
    const session = driver.createSession(
      ctx({ integrity: { digest: { algorithm: 'sha-256', hex: 'beef' }, metadataKey: 'sha256' } }),
      noopHandlers
    );

    void session.start();
    await flush();

    expect(captured[0].metadata.sha256).toBe('sha-256:beef');
    expect(captured[0].metadata.checksum).toBeUndefined();
  });

  it('adds no checksum metadata when integrity is absent', async () => {
    captured.length = 0;
    const driver = new TusDriver({ endpoint: 'https://tus.example/files' });
    const session = driver.createSession(ctx(), noopHandlers);

    void session.start();
    await flush();

    expect(captured[0].metadata.checksum).toBeUndefined();
  });
});
