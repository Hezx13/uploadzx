import { describe, it, expect, vi } from 'vitest';
import { UploadQueue } from '../src/core/UploadQueue';
import {
  FakeUploader,
  fakeUploaderFactory,
  InMemoryStore,
  makeUploadFile,
  mockHandle,
  tick,
} from './helpers';

const baseOpts = () => ({
  endpoint: 'https://tus.example/files',
  uploaderFactory: fakeUploaderFactory(),
  store: new InMemoryStore(),
});

describe('UploadQueue concurrency', () => {
  it('never runs more than maxConcurrent uploads at once', async () => {
    const queue = new UploadQueue({ ...baseOpts(), maxConcurrent: 2, autoStart: true });
    await queue.ready;

    await queue.addFiles([makeUploadFile(), makeUploadFile(), makeUploadFile(), makeUploadFile()]);
    expect(queue.getActiveCount()).toBe(2);
    expect(queue.getQueueLength()).toBe(2);

    // Completing one frees a slot for the next.
    FakeUploader.instances[0].complete();
    await tick();
    expect(queue.getActiveCount()).toBe(2);
    expect(queue.getQueueLength()).toBe(1);
  });

  it('resume goes back through the queue and respects the concurrency cap', async () => {
    const queue = new UploadQueue({ ...baseOpts(), maxConcurrent: 1, autoStart: true });
    await queue.ready;
    await queue.addFiles([makeUploadFile(), makeUploadFile()]);

    // One active, one queued.
    expect(queue.getActiveCount()).toBe(1);
    await queue.pauseAll();
    await queue.resumeAll();
    // Still capped at 1 despite two resumable uploaders.
    expect(queue.getActiveCount()).toBeLessThanOrEqual(1);
  });
});

describe('UploadQueue validation', () => {
  it('rejects oversized files via an error event and does not enqueue them', async () => {
    const onError = vi.fn();
    const queue = new UploadQueue({ ...baseOpts(), validation: { maxSize: 10 } }, { onError });
    await queue.ready;

    const accepted = await queue.addFiles([makeUploadFile({ size: 1000 })]);
    expect(accepted).toHaveLength(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(queue.getAllStates()).toHaveLength(0);
  });

  it('rejects the whole batch when maxFiles is exceeded', async () => {
    const onError = vi.fn();
    const queue = new UploadQueue({ ...baseOpts(), validation: { maxFiles: 1 } }, { onError });
    await queue.ready;
    const accepted = await queue.addFiles([makeUploadFile(), makeUploadFile()]);
    expect(accepted).toHaveLength(0);
    expect(onError).toHaveBeenCalledTimes(2);
  });
});

describe('UploadQueue.clearCompletedUploads', () => {
  it('removes completed/cancelled uploaders and keeps active ones', async () => {
    // autoEvict off so the completed uploader is retained until we clear it.
    const queue = new UploadQueue({
      ...baseOpts(),
      maxConcurrent: 3,
      autoStart: true,
      autoEvictCompleted: false,
    });
    await queue.ready;
    await queue.addFiles([
      makeUploadFile({ id: 'a' }),
      makeUploadFile({ id: 'b' }),
      makeUploadFile({ id: 'c' }),
    ]);

    FakeUploader.instances.find(u => u.file.id === 'a')!.complete();
    await tick();
    expect(queue.getUploadState('a')?.status).toBe('completed'); // retained pre-clear

    queue.clearCompletedUploads();
    const ids = queue.getAllStates().map(s => s.fileId);
    expect(ids).not.toContain('a'); // completed → removed
    expect(ids).toContain('b'); // active → kept
    expect(ids).toContain('c');
  });
});

describe('UploadQueue auto-eviction of completed uploads', () => {
  it('drops the completed uploader by default, freeing its retained File', async () => {
    const queue = new UploadQueue({ ...baseOpts(), maxConcurrent: 3, autoStart: true });
    await queue.ready;
    await queue.addFiles([makeUploadFile({ id: 'a' }), makeUploadFile({ id: 'b' })]);

    const completes: string[] = [];
    queue.on('complete', id => completes.push(id));

    FakeUploader.instances.find(u => u.file.id === 'a')!.complete();
    await tick();

    expect(completes).toEqual(['a']); // event still fires before eviction
    expect(queue.getUploadState('a')).toBeNull(); // evicted
    expect(queue.getUploadState('b')).not.toBeNull(); // active one untouched
    expect(queue.getAllStates().map(s => s.fileId)).not.toContain('a');
  });

  it('retains completed uploaders when autoEvictCompleted is false', async () => {
    const queue = new UploadQueue({
      ...baseOpts(),
      autoStart: true,
      autoEvictCompleted: false,
    });
    await queue.ready;
    await queue.addFiles([makeUploadFile({ id: 'a' })]);

    FakeUploader.instances.find(u => u.file.id === 'a')!.complete();
    await tick();

    expect(queue.getUploadState('a')?.status).toBe('completed');
  });
});

describe('UploadQueue events (emitter)', () => {
  it('supports multiple independent subscribers and unsubscribe', async () => {
    const queue = new UploadQueue({ ...baseOpts(), autoStart: true });
    await queue.ready;
    const a = vi.fn();
    const b = vi.fn();
    const offA = queue.on('complete', a);
    queue.on('complete', b);

    await queue.addFiles([makeUploadFile({ id: 'x' })]);
    offA();
    FakeUploader.instances[0].complete('https://done/x');
    await tick();

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith('x', 'https://done/x');
  });

  it('emits a single cancel event and cleans up', async () => {
    const queue = new UploadQueue({ ...baseOpts(), autoStart: true });
    await queue.ready;
    const onCancel = vi.fn();
    queue.on('cancel', onCancel);
    await queue.addFiles([makeUploadFile({ id: 'c1' })]);

    await queue.cancelUpload('c1');
    await tick();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(queue.getActiveCount()).toBe(0);
  });
});

describe('UploadQueue persistence', () => {
  it('persists progress and exposes the file as restorable', async () => {
    const store = new InMemoryStore();
    const queue = new UploadQueue({
      endpoint: 'https://tus.example/files',
      uploaderFactory: fakeUploaderFactory(),
      store,
      autoStart: true,
    });
    await queue.ready;

    const file = new File(['payload'], 'p.bin');
    await queue.addFiles([makeUploadFile({ id: 'p1', fileHandle: mockHandle(file), file })]);

    FakeUploader.instances[0].progress(3);
    // Progress persistence is throttled; pausing forces a flush of the offset.
    await queue.pauseUpload('p1');
    await tick();
    expect(store.records.get('p1')?.bytesUploaded).toBe(3);
    expect(store.records.get('p1')?.resumeData).toBeTruthy();
  });
});

describe('UploadQueue restore integrity', () => {
  it('drops a persisted upload whose file changed size since last access', async () => {
    const store = new InMemoryStore();
    // Persisted handle claims size 999, but the actual cached file is 7 bytes.
    const file = new File(['payload'], 'p.bin'); // size 7
    store.records.set('p1', {
      id: 'p1',
      name: 'p.bin',
      size: 999,
      type: '',
      handle: mockHandle(file),
      lastModified: file.lastModified,
    });
    store.files.set('p1', file);

    const queue = new UploadQueue({
      endpoint: 'https://tus.example/files',
      uploaderFactory: fakeUploaderFactory(),
      store,
      autoStart: true,
    });
    await queue.ready;

    await queue.restoreUnfinishedUpload('p1');
    // Mismatch detected → handle removed, no uploader created.
    expect(store.records.has('p1')).toBe(false);
    expect(queue.getAllStates()).toHaveLength(0);
  });
});

describe('UploadQueue SSR-ish init', () => {
  it('becomes ready and initialized', async () => {
    const queue = new UploadQueue(baseOpts());
    await queue.ready;
    expect(queue.getIsInitialized()).toBe(true);
  });
});
