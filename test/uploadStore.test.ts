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

  describe('queue stats', () => {
    it('notifies on change and bails when unchanged', () => {
      const store = new UploadStore();
      const l = vi.fn();
      store.subscribeStats(l);

      store.setStats({ queueLength: 2, activeCount: 1 });
      expect(l).toHaveBeenCalledTimes(1);
      expect(store.getStats()).toEqual({ queueLength: 2, activeCount: 1 });

      // Same numbers → no notification.
      store.setStats({ queueLength: 2, activeCount: 1 });
      expect(l).toHaveBeenCalledTimes(1);

      store.setStats({ queueLength: 2, activeCount: 0 });
      expect(l).toHaveBeenCalledTimes(2);
    });
  });

  describe('unfinished uploads', () => {
    const handle = (id: string) => ({ id }) as any;

    it('sets, notifies, and removes; bails when removing an absent id', () => {
      const store = new UploadStore();
      const l = vi.fn();
      store.subscribeUnfinished(l);

      store.setUnfinished([handle('a'), handle('b')]);
      expect(l).toHaveBeenCalledTimes(1);

      store.removeUnfinished('zzz'); // absent → no notify
      expect(l).toHaveBeenCalledTimes(1);

      store.removeUnfinished('a');
      expect(l).toHaveBeenCalledTimes(2);
      expect(store.getUnfinished().map(u => u.id)).toEqual(['b']);
    });
  });

  describe('init flag', () => {
    it('notifies once per real change', () => {
      const store = new UploadStore();
      const l = vi.fn();
      store.subscribeInitialized(l);

      store.setInitialized(true);
      store.setInitialized(true); // unchanged → no notify
      expect(l).toHaveBeenCalledTimes(1);
      expect(store.getInitialized()).toBe(true);
    });
  });

  it('reset() clears every section', () => {
    const store = new UploadStore();
    store.setState(state('a'));
    store.setStats({ queueLength: 1, activeCount: 1 });
    store.setUnfinished([{ id: 'x' } as any]);
    store.setInitialized(true);

    store.reset();

    expect(store.getState('a')).toBeNull();
    expect(store.getStats()).toEqual({ queueLength: 0, activeCount: 0 });
    expect(store.getUnfinished()).toEqual([]);
    expect(store.getInitialized()).toBe(false);
  });
});
