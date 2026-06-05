import { describe, it, expect, vi } from 'vitest';
import { UploadStore } from '../src/react/UploadStore';
import type { UploadState } from '../src/types';

function state(fileId: string, bytes = 0): UploadState {
  return {
    fileId,
    status: 'uploading',
    file: new File([''], `${fileId}.bin`),
    progress: {
      fileId,
      bytesUploaded: bytes,
      bytesTotal: 100,
      percentage: bytes,
      bytesPerSecond: 0,
    },
  };
}

describe('UploadStore', () => {
  it('notifies only the listener for the changed file', () => {
    const store = new UploadStore();
    const aListener = vi.fn();
    const bListener = vi.fn();
    store.subscribeFile('a')(aListener);
    store.subscribeFile('b')(bListener);

    store.setState(state('a', 10));
    expect(aListener).toHaveBeenCalledTimes(1);
    expect(bListener).not.toHaveBeenCalled();
  });

  it('returns a stable record snapshot until something changes', () => {
    const store = new UploadStore();
    const s1 = store.getRecordSnapshot();
    expect(s1).toEqual({});
    store.setState(state('a', 5));
    const s2 = store.getRecordSnapshot();
    expect(s2).not.toBe(s1);
    expect(store.getRecordSnapshot()).toBe(s2); // cached when unchanged
    expect(s2.a.progress.bytesUploaded).toBe(5);
  });

  it('global listeners fire on any change', () => {
    const store = new UploadStore();
    const g = vi.fn();
    store.subscribeGlobal(g);
    store.setState(state('a'));
    store.setState(state('b'));
    expect(g).toHaveBeenCalledTimes(2);
  });

  it('remove() drops state and notifies', () => {
    const store = new UploadStore();
    store.setState(state('a'));
    const a = vi.fn();
    store.subscribeFile('a')(a);
    store.remove('a');
    expect(store.getState('a')).toBeNull();
    expect(a).toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const store = new UploadStore();
    const a = vi.fn();
    const unsub = store.subscribeFile('a')(a);
    unsub();
    store.setState(state('a'));
    expect(a).not.toHaveBeenCalled();
  });
});
