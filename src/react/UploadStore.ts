import type { UploadState } from '../types';

type Listener = () => void;

/**
 * Framework-agnostic external store for per-file upload state.
 *
 * The point of this store is granular subscriptions: a component watching one
 * file via `subscribeFile` is only notified when *that* file changes, so a list
 * of N uploads no longer re-renders every row on every progress tick of any
 * file. Consumed through React's `useSyncExternalStore`.
 */
export class UploadStore {
  private states = new Map<string, UploadState>();
  private fileListeners = new Map<string, Set<Listener>>();
  private globalListeners = new Set<Listener>();

  /** Cached record snapshot; identity only changes when something changes. */
  private recordSnapshot: Record<string, UploadState> = {};
  private dirty = false;

  setState(state: UploadState): void {
    this.states.set(state.fileId, state);
    this.dirty = true;
    this.notifyFile(state.fileId);
    this.notifyGlobal();
  }

  remove(fileId: string): void {
    if (this.states.delete(fileId)) {
      this.dirty = true;
      this.notifyFile(fileId);
      this.notifyGlobal();
    }
  }

  clear(): void {
    const ids = Array.from(this.states.keys());
    this.states.clear();
    this.dirty = true;
    ids.forEach(id => this.notifyFile(id));
    this.notifyGlobal();
  }

  getState = (fileId: string): UploadState | null => {
    return this.states.get(fileId) ?? null;
  };

  /** Returns a referentially-stable record, rebuilt only when state changed. */
  getRecordSnapshot = (): Record<string, UploadState> => {
    if (this.dirty) {
      this.recordSnapshot = Object.fromEntries(this.states);
      this.dirty = false;
    }
    return this.recordSnapshot;
  };

  subscribeFile(fileId: string): (listener: Listener) => () => void {
    return (listener: Listener) => {
      let set = this.fileListeners.get(fileId);
      if (!set) {
        set = new Set();
        this.fileListeners.set(fileId, set);
      }
      set.add(listener);
      return () => {
        set?.delete(listener);
        if (set && set.size === 0) {
          this.fileListeners.delete(fileId);
        }
      };
    };
  }

  subscribeGlobal = (listener: Listener): (() => void) => {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  };

  private notifyFile(fileId: string): void {
    this.fileListeners.get(fileId)?.forEach(l => l());
  }

  private notifyGlobal(): void {
    this.globalListeners.forEach(l => l());
  }
}
