// @vitest-environment node
//
// Node + fake-indexeddb for reliable Blob structured clone (happy-dom Blobs fail).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

(globalThis as unknown as { window: unknown }).window = globalThis;

import { FsStore } from '../src/fs/store/FsStore';
import { createRecordFromHandle } from '../src/fs/utils';
import { createMockFileHandle } from '../src/utils';
import { mockHandle } from './helpers';

describe('FsStore', () => {
  let store: FsStore;

  beforeEach(async () => {
    store = new FsStore({ dbName: `test-fs-${crypto.randomUUID()}`, thumbCacheBudgetBytes: 35_000 });
    await store.init();
  });

  describe('native-handle platforms', () => {
    let nativeStore: FsStore;

    beforeEach(async () => {
      (globalThis as unknown as { showOpenFilePicker: unknown }).showOpenFilePicker = () => {};
      (globalThis as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = () => {};
      (globalThis as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = () => {};
      nativeStore = new FsStore({ dbName: `test-fs-native-${crypto.randomUUID()}` });
      await nativeStore.init();
    });

    afterEach(() => {
      // Don't leak native-FS-support globals into sibling tests, which rely
      // on the (non-native) byte-cache path.
      delete (globalThis as Record<string, unknown>).showOpenFilePicker;
      delete (globalThis as Record<string, unknown>).showSaveFilePicker;
      delete (globalThis as Record<string, unknown>).showDirectoryPicker;
    });

    it('joins persisted handles back onto list() results', async () => {
      // Plain, function-free handle stand-in: real FileSystemFileHandle
      // instances have special browser structured-clone support that a JS
      // mock with function properties (getFile, etc.) cannot replicate under
      // fake-indexeddb, so this only exercises the STORE_HANDLES join in
      // list() — not full clone-ability of a real handle.
      const handle = { kind: 'file', name: 'joined.jpg' } as unknown as FileSystemFileHandle;
      const rec = createRecordFromHandle(handle, { id: 'join-1' });
      await nativeStore.put(rec);

      const [loaded] = await nativeStore.list();
      expect(loaded.handle).toBeDefined();
      expect((loaded.handle as FileSystemFileHandle).name).toBe('joined.jpg');
    });

    it('does not persist a synthetic handle, and does not throw', async () => {
      const file = new File(['x'], 'synthetic.jpg', { type: 'image/jpeg' });
      // createMockFileHandle is the real Safari-fallback shim (tagged
      // synthetic) — unlike test helper mockHandle(), which stands in for a
      // "real" native handle in other tests.
      const rec = createRecordFromHandle(createMockFileHandle(file), { id: 'synth-1', file });

      await expect(nativeStore.put(rec)).resolves.not.toThrow();

      const [loaded] = await nativeStore.list();
      expect(loaded.name).toBe('synthetic.jpg');
      expect(loaded.handle).toBeUndefined();
    });
  });

  it('stores and retrieves records via byte cache path', async () => {
    const file = new File(['hello'], 'test.jpg', { type: 'image/jpeg' });
    const rec = createRecordFromHandle(mockHandle(file), { file });
    const cached = await store.cacheFileIfNeeded(rec, file);
    await store.put(cached);

    const loaded = await store.get(rec.id);
    expect(loaded?.name).toBe('test.jpg');
    expect(loaded?.schemaVersion).toBe(1);
  });

  it('lists records by parentId', async () => {
    const parent = createRecordFromHandle(
      { kind: 'directory', name: 'photos' } as FileSystemDirectoryHandle,
      {}
    );
    await store.put(parent);

    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const child = createRecordFromHandle(mockHandle(file), { parentId: parent.id, file });
    const cached = await store.cacheFileIfNeeded(child, file);
    await store.put(cached);

    const children = await store.list({ parentId: parent.id });
    expect(children).toHaveLength(1);
    expect(children[0].name).toBe('a.jpg');
  });

  it('caches and retrieves thumbnails with LRU eviction', async () => {
    const blob1 = new Blob([new Uint8Array(15_000)], { type: 'image/webp' });
    const blob2 = new Blob([new Uint8Array(15_000)], { type: 'image/webp' });
    const blob3 = new Blob([new Uint8Array(15_000)], { type: 'image/webp' });

    await store.putThumb('t1', blob1);
    await new Promise(r => setTimeout(r, 10));
    await store.putThumb('t2', blob2);
    await store.getThumb('t1');
    await store.putThumb('t3', blob3);

    expect(await store.getThumb('t2')).toBeNull();
    expect(await store.getThumb('t1')).not.toBeNull();
    expect(await store.getThumb('t3')).not.toBeNull();
  });

  it('reads file from cached bytes', async () => {
    const file = new File(['data'], 'read.jpg', { type: 'image/jpeg' });
    const rec = createRecordFromHandle(mockHandle(file), { file });
    const cached = await store.cacheFileIfNeeded(rec, file);
    await store.put(cached);

    const read = await store.getFileForRecord(cached);
    expect(read?.name).toBe('read.jpg');
    expect(await read!.text()).toBe('data');
  });

  it('removes record and associated thumb', async () => {
    const file = new File([''], 'del.jpg', { type: 'image/jpeg' });
    const rec = createRecordFromHandle(mockHandle(file), { file, id: 'del-1' });
    rec.thumbKey = 'thumb-del-1';
    await store.put(rec);
    await store.putThumb('thumb-del-1', new Blob(['thumb']));

    await store.remove('del-1');
    expect(await store.get('del-1')).toBeNull();
    expect(await store.getThumb('thumb-del-1')).toBeNull();
  });
});
