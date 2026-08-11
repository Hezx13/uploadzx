import { TypedEmitter } from '../../utils/emitter';
import type { FsPermissionMode } from '../types';

export interface PermissionManagerEvents {
  permissionchange: (pending: FileSystemHandle[]) => void;
  [key: string]: (...args: any[]) => void;
}

type HandleKey = string;

function handleKey(handle: FileSystemHandle): HandleKey {
  return `${handle.kind}:${handle.name}`;
}

export class PermissionManager extends TypedEmitter<PermissionManagerEvents> {
  private pendingHandles = new Map<HandleKey, FileSystemHandle>();
  private deniedHandles = new Set<HandleKey>();
  private grantedHandles = new Map<HandleKey, FsPermissionMode>();
  /**
   * Cached snapshot of pendingHandles.values(), rebuilt only when the map
   * actually changes. `pending()` must return a referentially stable array
   * when nothing changed, or `useSyncExternalStore` consumers loop forever.
   */
  private pendingCache: FileSystemHandle[] = [];

  async query(handle: FileSystemHandle, mode: FsPermissionMode): Promise<PermissionState> {
    const key = handleKey(handle);
    if (this.deniedHandles.has(key)) {
      return 'denied';
    }
    if (this.grantedHandles.has(key)) {
      const granted = this.grantedHandles.get(key)!;
      if (granted === mode || (granted === 'readwrite' && mode === 'read')) {
        return 'granted';
      }
    }

    if (!this.hasPermissionApi(handle)) {
      return 'granted';
    }

    try {
      const h = handle as FileSystemHandle & {
        queryPermission(d: { mode: string }): Promise<PermissionState>;
      };
      return await h.queryPermission({ mode });
    } catch {
      return 'prompt';
    }
  }

  async ensure(
    handles: FileSystemHandle[],
    mode: FsPermissionMode,
    opts: { withinGesture: boolean }
  ): Promise<{
    granted: FileSystemHandle[];
    pending: FileSystemHandle[];
    denied: FileSystemHandle[];
  }> {
    const granted: FileSystemHandle[] = [];
    const pending: FileSystemHandle[] = [];
    const denied: FileSystemHandle[] = [];
    // Tracks whether pendingHandles changed at all this call — including a
    // pending handle being resolved down to zero — so we know whether to
    // notify subscribers, independent of what the resulting size happens to be.
    let pendingChanged = false;

    const unique = this.dedupeHandles(handles);

    for (const handle of unique) {
      const key = handleKey(handle);
      if (this.deniedHandles.has(key)) {
        denied.push(handle);
        continue;
      }

      const state = await this.query(handle, mode);

      if (state === 'granted') {
        this.grantedHandles.set(key, mode);
        pendingChanged = this.pendingHandles.delete(key) || pendingChanged;
        granted.push(handle);
        continue;
      }

      if (state === 'denied') {
        this.deniedHandles.add(key);
        pendingChanged = this.pendingHandles.delete(key) || pendingChanged;
        denied.push(handle);
        continue;
      }

      if (!opts.withinGesture) {
        this.pendingHandles.set(key, handle);
        pendingChanged = true;
        pending.push(handle);
        continue;
      }

      const requested = await this.request(handle, mode);
      if (requested === 'granted') {
        this.grantedHandles.set(key, mode);
        pendingChanged = this.pendingHandles.delete(key) || pendingChanged;
        granted.push(handle);
      } else if (requested === 'denied') {
        this.deniedHandles.add(key);
        pendingChanged = this.pendingHandles.delete(key) || pendingChanged;
        denied.push(handle);
      } else {
        this.pendingHandles.set(key, handle);
        pendingChanged = true;
        pending.push(handle);
      }
    }

    if (pendingChanged) {
      this.syncPendingCache();
      this.emit('permissionchange', this.pending());
    }

    return { granted, pending, denied };
  }

  pending(): FileSystemHandle[] {
    return this.pendingCache;
  }

  clearDenied(): void {
    this.deniedHandles.clear();
    this.emit('permissionchange', this.pending());
  }

  reset(): void {
    this.pendingHandles.clear();
    this.deniedHandles.clear();
    this.grantedHandles.clear();
    this.syncPendingCache();
    this.emit('permissionchange', this.pending());
  }

  private syncPendingCache(): void {
    this.pendingCache = Array.from(this.pendingHandles.values());
  }

  private async request(
    handle: FileSystemHandle,
    mode: FsPermissionMode
  ): Promise<PermissionState> {
    if (!this.hasPermissionApi(handle)) {
      return 'granted';
    }

    try {
      const h = handle as FileSystemHandle & {
        requestPermission(d: { mode: string }): Promise<PermissionState>;
      };
      return await h.requestPermission({ mode });
    } catch {
      return 'prompt';
    }
  }

  private hasPermissionApi(handle: FileSystemHandle): boolean {
    return (
      typeof (handle as FileSystemHandle & { queryPermission?: unknown }).queryPermission ===
      'function'
    );
  }

  private dedupeHandles(handles: FileSystemHandle[]): FileSystemHandle[] {
    const seen = new Set<HandleKey>();
    const out: FileSystemHandle[] = [];
    for (const h of handles) {
      const key = handleKey(h);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(h);
      }
    }
    return out;
  }

  /** Prefer a single directory grant; returns child handles that inherit access. */
  async ensureDirectoryCovers(
    dirHandle: FileSystemDirectoryHandle,
    childHandles: FileSystemHandle[],
    mode: FsPermissionMode,
    opts: { withinGesture: boolean }
  ): Promise<{
    granted: FileSystemHandle[];
    pending: FileSystemHandle[];
    denied: FileSystemHandle[];
  }> {
    const dirResult = await this.ensure([dirHandle], mode, opts);
    if (dirResult.granted.length === 0) {
      return dirResult;
    }
    let pendingChanged = false;
    for (const child of childHandles) {
      const key = handleKey(child);
      this.grantedHandles.set(key, mode);
      pendingChanged = this.pendingHandles.delete(key) || pendingChanged;
    }
    if (pendingChanged) {
      this.syncPendingCache();
      this.emit('permissionchange', this.pending());
    }
    return {
      granted: [...dirResult.granted, ...childHandles],
      pending: dirResult.pending,
      denied: dirResult.denied,
    };
  }
}
