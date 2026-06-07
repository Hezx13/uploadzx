import type { StoredFileHandle, UploadState } from '../types';

type Listener = () => void;

export interface QueueStats {
  queueLength: number;
  activeCount: number;
}

/**
 * Framework-agnostic external store holding all of the reactive state for a
 * single Uploadzx instance: per-file upload state, queue stats, the list of
 * resumable unfinished uploads, and the init flag.
 *
 * Why a store instead of React context for this data: it changes frequently
 * (progress ticks) and is read by many independent subscribers. Context would
 * re-render every consumer on every change. Instead, consumers subscribe to
 * exactly the slice they care about via `useSyncExternalStore`, so a row that
 * only renders a status badge is not re-rendered by another file's progress.
 *
 * Each section keeps its own listener set and a referentially-stable snapshot so
 * `useSyncExternalStore` (and selector hooks built on it) stay tear-free.
 */
export class UploadStore {
  // --- per-file upload states ---
  private states = new Map<string, UploadState>();
  private fileListeners = new Map<string, Set<Listener>>();
  private statesListeners = new Set<Listener>();
  private recordSnapshot: Record<string, UploadState> = {};
  private recordDirty = false;

  // --- queue stats ---
  private stats: QueueStats = { queueLength: 0, activeCount: 0 };
  private statsListeners = new Set<Listener>();

  // --- unfinished (resumable) uploads ---
  private unfinished: StoredFileHandle[] = [];
  private unfinishedListeners = new Set<Listener>();

  // --- init flag ---
  private initialized = false;
  private initListeners = new Set<Listener>();

  // ---------------------------------------------------------------------------
  // Per-file states
  // ---------------------------------------------------------------------------

  setState(state: UploadState): void {
    this.states.set(state.fileId, state);
    this.recordDirty = true;
    this.notify(this.fileListeners.get(state.fileId));
    this.notify(this.statesListeners);
  }

  remove(fileId: string): void {
    if (this.states.delete(fileId)) {
      this.recordDirty = true;
      this.notify(this.fileListeners.get(fileId));
      this.notify(this.statesListeners);
    }
  }

  getState = (fileId: string): UploadState | null => {
    return this.states.get(fileId) ?? null;
  };

  /** Referentially-stable record, rebuilt only when state changed. */
  getRecordSnapshot = (): Record<string, UploadState> => {
    if (this.recordDirty) {
      this.recordSnapshot = Object.fromEntries(this.states);
      this.recordDirty = false;
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

  /** Subscribe to changes in *any* file's state. */
  subscribeStates = (listener: Listener): (() => void) => {
    this.statesListeners.add(listener);
    return () => this.statesListeners.delete(listener);
  };

  /** @deprecated Alias of {@link subscribeStates}. */
  subscribeGlobal = (listener: Listener): (() => void) => this.subscribeStates(listener);

  // ---------------------------------------------------------------------------
  // Queue stats
  // ---------------------------------------------------------------------------

  /** Update stats; no-op (and no notification) when the numbers are unchanged. */
  setStats(stats: QueueStats): void {
    if (
      stats.queueLength === this.stats.queueLength &&
      stats.activeCount === this.stats.activeCount
    ) {
      return;
    }
    this.stats = stats;
    this.notify(this.statsListeners);
  }

  getStats = (): QueueStats => this.stats;

  subscribeStats = (listener: Listener): (() => void) => {
    this.statsListeners.add(listener);
    return () => this.statsListeners.delete(listener);
  };

  // ---------------------------------------------------------------------------
  // Unfinished (resumable) uploads
  // ---------------------------------------------------------------------------

  setUnfinished(list: StoredFileHandle[]): void {
    this.unfinished = list;
    this.notify(this.unfinishedListeners);
  }

  /** Drop one unfinished record; no-op (and no notification) if absent. */
  removeUnfinished(id: string): void {
    if (!this.unfinished.some(u => u.id === id)) {
      return;
    }
    this.unfinished = this.unfinished.filter(u => u.id !== id);
    this.notify(this.unfinishedListeners);
  }

  getUnfinished = (): StoredFileHandle[] => this.unfinished;

  subscribeUnfinished = (listener: Listener): (() => void) => {
    this.unfinishedListeners.add(listener);
    return () => this.unfinishedListeners.delete(listener);
  };

  // ---------------------------------------------------------------------------
  // Init flag
  // ---------------------------------------------------------------------------

  setInitialized(value: boolean): void {
    if (this.initialized === value) return;
    this.initialized = value;
    this.notify(this.initListeners);
  }

  getInitialized = (): boolean => this.initialized;

  subscribeInitialized = (listener: Listener): (() => void) => {
    this.initListeners.add(listener);
    return () => this.initListeners.delete(listener);
  };

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Clears per-file state (used when tearing down). */
  clear(): void {
    const ids = Array.from(this.states.keys());
    this.states.clear();
    this.recordDirty = true;
    ids.forEach(id => this.notify(this.fileListeners.get(id)));
    this.notify(this.statesListeners);
  }

  /** Full reset of every section back to empty/initial values. */
  reset(): void {
    this.clear();
    this.setStats({ queueLength: 0, activeCount: 0 });
    this.setUnfinished([]);
    this.setInitialized(false);
  }

  private notify(set: Set<Listener> | undefined): void {
    set?.forEach(l => l());
  }
}
