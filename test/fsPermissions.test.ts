import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionManager } from '../src/fs/permissions/PermissionManager';

function mockHandle(
  name: string,
  states: { query?: PermissionState; request?: PermissionState } = {}
): FileSystemFileHandle {
  return {
    kind: 'file',
    name,
    getFile: async () => new File([''], name),
    queryPermission: async () => states.query ?? 'prompt',
    requestPermission: async () => states.request ?? 'granted',
    createWritable: async () => {
      throw new Error('not implemented');
    },
    isSameEntry: async () => false,
  } as unknown as FileSystemFileHandle;
}

describe('PermissionManager', () => {
  let pm: PermissionManager;

  beforeEach(() => {
    pm = new PermissionManager();
  });

  it('returns granted without request when query is granted', async () => {
    const h = mockHandle('a.jpg', { query: 'granted' });
    const result = await pm.ensure([h], 'read', { withinGesture: false });
    expect(result.granted).toHaveLength(1);
    expect(result.pending).toHaveLength(0);
  });

  it('defers request when not within gesture', async () => {
    const h = mockHandle('b.jpg', { query: 'prompt' });
    const result = await pm.ensure([h], 'read', { withinGesture: false });
    expect(result.pending).toHaveLength(1);
    expect(pm.pending()).toHaveLength(1);
  });

  it('requests permission within gesture', async () => {
    const h = mockHandle('c.jpg', { query: 'prompt', request: 'granted' });
    const result = await pm.ensure([h], 'read', { withinGesture: true });
    expect(result.granted).toHaveLength(1);
    expect(pm.pending()).toHaveLength(0);
  });

  it('remembers denied handles for the session', async () => {
    const h = mockHandle('d.jpg', { query: 'prompt', request: 'denied' });
    await pm.ensure([h], 'read', { withinGesture: true });
    const again = await pm.ensure([h], 'read', { withinGesture: true });
    expect(again.denied).toHaveLength(1);
  });

  it('emits permissionchange when pending handles exist', async () => {
    const h = mockHandle('e.jpg', { query: 'prompt' });
    let emitted: FileSystemHandle[] | undefined;
    pm.on('permissionchange', pending => {
      emitted = pending;
    });
    await pm.ensure([h], 'read', { withinGesture: false });
    expect(emitted).toHaveLength(1);
  });

  it('dedupes duplicate handles', async () => {
    const h = mockHandle('f.jpg', { query: 'granted' });
    const result = await pm.ensure([h, h], 'read', { withinGesture: false });
    expect(result.granted).toHaveLength(1);
  });

  it('returns a referentially stable pending() array across unrelated calls', async () => {
    // useSyncExternalStore requires getSnapshot() to return the same
    // reference when nothing changed, or React loops forever re-rendering.
    const h = mockHandle('stable.jpg', { query: 'prompt' });
    await pm.ensure([h], 'read', { withinGesture: false });

    const first = pm.pending();
    const second = pm.pending();
    expect(second).toBe(first);

    // A call that resolves nothing new (e.g. re-querying an already-granted
    // handle) must not produce a new array either.
    const other = mockHandle('granted.jpg', { query: 'granted' });
    await pm.ensure([other], 'read', { withinGesture: false });
    expect(pm.pending()).toBe(first);
  });

  it('emits permissionchange when the last pending handle clears', async () => {
    const h = mockHandle('g.jpg', { query: 'prompt', request: 'granted' });
    await pm.ensure([h], 'read', { withinGesture: false });
    expect(pm.pending()).toHaveLength(1);

    let lastEmitted: FileSystemHandle[] | undefined;
    let emitCount = 0;
    pm.on('permissionchange', pending => {
      emitCount++;
      lastEmitted = pending;
    });

    // Resolving the only pending handle within a gesture should notify
    // subscribers that pending is now empty, not stay silent.
    await pm.ensure([h], 'read', { withinGesture: true });
    expect(emitCount).toBe(1);
    expect(lastEmitted).toHaveLength(0);
    expect(pm.pending()).toHaveLength(0);
  });
});
