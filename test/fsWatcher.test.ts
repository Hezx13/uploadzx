// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

(globalThis as unknown as { window: unknown }).window = globalThis;

import { FileWatcher } from '../src/fs/watch/FileWatcher';
import { FsStore } from '../src/fs/store/FsStore';
import { createRecordFromHandle } from '../src/fs/utils';
import { mockHandle } from './helpers';

describe('FileWatcher poll fallback', () => {
  let store: FsStore;
  let watcher: FileWatcher;

  beforeEach(async () => {
    store = new FsStore({ dbName: `test-watch-${crypto.randomUUID()}` });
    await store.init();
    watcher = new FileWatcher(store, { pollIntervalMs: 50 });
  });

  afterEach(() => {
    watcher.stop();
  });

  it('emits add for new files on poll', async () => {
    const dir = {
      kind: 'directory',
      name: 'lib',
      entries: async function* () {},
    } as unknown as FileSystemDirectoryHandle;

    const adds: string[] = [];
    watcher.on('add', entry => adds.push(entry.name));

    await watcher.watchDirectory(dir);

    const file = new File(['v1'], 'watch.jpg', { type: 'image/jpeg' });
    const rec = createRecordFromHandle(mockHandle(file), { file, id: 'w1' });
    const cached = await store.cacheFileIfNeeded(rec, file);
    await store.put(cached);

    await new Promise(r => setTimeout(r, 150));
    expect(adds).toContain('watch.jpg');
  });
});

describe('FileSystemManager', () => {
  it('initializes and lists persisted entries', async () => {
    const { FileSystemManager } = await import('../src/fs/FileSystemManager');
    const mgr = new FileSystemManager({ dbName: `test-mgr-${crypto.randomUUID()}` });
    await mgr.ready;

    const file = new File(['x'], 'mgr.jpg', { type: 'image/jpeg' });
    const rec = createRecordFromHandle(mockHandle(file), { file });
    const cached = await mgr.store.cacheFileIfNeeded(rec, file);
    await mgr.store.put(cached);

    const list = await mgr.list();
    expect(list.some(e => e.name === 'mgr.jpg')).toBe(true);
    mgr.destroy();
  });
});
