// @vitest-environment node
//
// Runs under Node (not happy-dom) so File/Blob are Node-native and survive
// fake-indexeddb's structured clone intact — happy-dom's Blob does not. We shim
// just enough of a browser (`window`) for isBrowser()/the Safari fallback path.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

(globalThis as unknown as { window: unknown }).window = globalThis;

import { FileHandleStore } from '../src/core/FileHandleStore';
import { mockHandle } from './helpers';

function deleteDB(): Promise<void> {
  return new Promise(resolve => {
    const req = indexedDB.deleteDatabase('uploadzx-filehandles');
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

describe('FileHandleStore (Safari fallback path)', () => {
  let store: FileHandleStore;

  beforeEach(async () => {
    await deleteDB();
    store = new FileHandleStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('persists metadata and round-trips the file payload', async () => {
    const file = new File(['hello payload'], 'doc.txt', { type: 'text/plain' });
    await store.storeFileHandle(mockHandle(file), 'id-1');

    const all = await store.getAllFileHandles();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: 'id-1', name: 'doc.txt', type: 'text/plain' });

    const restored = await store.getFileFromHandleByID('id-1');
    expect(restored).not.toBeNull();
    expect(await restored!.text()).toBe('hello payload');
  });

  it('updates progress without touching the payload', async () => {
    const file = new File(['abc'], 'a.bin');
    await store.storeFileHandle(mockHandle(file), 'id-2');
    await store.updateFileHandleProgress('id-2', 'https://tus/upload/2', 2);

    const handle = await store.getFileHandle('id-2');
    expect(handle?.tusUploadUrl).toBe('https://tus/upload/2');
    expect(handle?.bytesUploaded).toBe(2);
    const restored = await store.getFileFromHandleByID('id-2');
    expect(await restored!.text()).toBe('abc');
  });

  it('removeFileHandle clears metadata and blob', async () => {
    const file = new File(['z'], 'z.bin');
    await store.storeFileHandle(mockHandle(file), 'id-3');
    await store.removeFileHandle('id-3');

    expect(await store.getFileHandle('id-3')).toBeNull();
    expect(await store.getFileFromHandleByID('id-3')).toBeNull();
    expect(await store.getAllFileHandles()).toHaveLength(0);
  });

  it('clear() resolves only after the wipe is committed', async () => {
    await store.storeFileHandle(mockHandle(new File(['a'], 'a')), 'id-a');
    await store.storeFileHandle(mockHandle(new File(['b'], 'b')), 'id-b');
    await store.clear();
    expect(await store.getAllFileHandles()).toHaveLength(0);
  });

  it('reapStale removes records older than the TTL', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    await store.storeFileHandle(mockHandle(new File(['old'], 'old')), 'old-id');
    nowSpy.mockRestore();

    await store.storeFileHandle(mockHandle(new File(['new'], 'new')), 'new-id');

    await store.reapStale(60_000);
    const remaining = await store.getAllFileHandles();
    expect(remaining.map(r => r.id)).toEqual(['new-id']);
  });

  it('refuses to cache a payload that exceeds the storage quota', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ usage: 0, quota: 50 }) } });
    const big = new File(['x'.repeat(1000)], 'big.bin');
    await expect(store.storeFileHandle(mockHandle(big), 'big-id')).rejects.toThrow(
      /insufficient storage/
    );
    expect(await store.getAllFileHandles()).toHaveLength(0);
  });
});
