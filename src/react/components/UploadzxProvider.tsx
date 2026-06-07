import { createContext, useContext, ReactNode } from 'react';
import { useUploadzx, UseUploadzxOptions, UploadzxActions } from '../hooks/useUploadzx';
import { useStoreSelector } from '../hooks/useStoreSelector';
import type { StoredFileHandle, UploadState } from '../../types';
import type { QueueStats, UploadStore } from '../UploadStore';

export type { UploadzxActions } from '../hooks/useUploadzx';

/**
 * The provider exposes a single, stable context value: `{ actions, store }`.
 * Both have identities fixed for the provider's lifetime, so context never
 * triggers a re-render. Every dynamic value (per-file state, queue stats,
 * unfinished list, init flag) lives in the {@link UploadStore} and is read
 * through `useSyncExternalStore`-backed selector hooks below — so a component
 * only re-renders when the precise slice it subscribed to changes.
 */
interface UploadzxContextValue {
  actions: UploadzxActions;
  store: UploadStore;
}

const UploadzxContext = createContext<UploadzxContextValue | null>(null);

interface UploadzxProviderProps {
  children: ReactNode;
  options: UseUploadzxOptions;
}

export function UploadzxProvider({ children, options }: UploadzxProviderProps) {
  const value = useUploadzx(options);
  return <UploadzxContext.Provider value={value}>{children}</UploadzxContext.Provider>;
}

function useUploadzxContextValue(hook: string): UploadzxContextValue {
  const context = useContext(UploadzxContext);
  if (!context) {
    throw new Error(`${hook} must be used within UploadzxProvider`);
  }
  return context;
}

/** Stable action surface. Never causes a re-render on its own. */
export function useUploadzxActions(): UploadzxActions {
  return useUploadzxContextValue('useUploadzxActions').actions;
}

/** Access the raw external store (advanced). Prefer the selector hooks. */
export function useUploadStore(): UploadStore {
  return useUploadzxContextValue('useUploadStore').store;
}

/** Reactive `isInitialized` flag, sourced from the store. */
export function useUploadzxState(): { isInitialized: boolean } {
  const store = useUploadStore();
  const isInitialized = useStoreSelector(store.subscribeInitialized, store.getInitialized, v => v);
  return { isInitialized };
}

/**
 * Live record of all upload states. Re-renders on every progress tick by design —
 * for a single row prefer `useUploadState(fileId)` / `useUploadProgress(fileId)`,
 * which subscribe granularly.
 */
export function useUploadStates(): { uploadStates: Record<string, UploadState> } {
  const store = useUploadStore();
  const uploadStates = useStoreSelector(store.subscribeStates, store.getRecordSnapshot, v => v);
  return { uploadStates };
}

export function useQueueStats(): { queueStats: QueueStats } {
  const store = useUploadStore();
  const queueStats = useStoreSelector(store.subscribeStats, store.getStats, v => v);
  return { queueStats };
}

export function useUnfinishedUploads(): { unfinishedUploads: StoredFileHandle[] } {
  const store = useUploadStore();
  const unfinishedUploads = useStoreSelector(
    store.subscribeUnfinished,
    store.getUnfinished,
    v => v
  );
  return { unfinishedUploads };
}

// TODO: remove later, only for backward compatibility
/**
 * @deprecated Use the focused hooks instead: `useUploadzxActions`,
 * `useUploadzxState`, `useUploadStates`, `useQueueStats`, `useUnfinishedUploads`.
 * This hook re-renders on every progress tick because it reads the full states
 * record.
 */
export function useUploadzxContext() {
  const actions = useUploadzxActions();
  const state = useUploadzxState();
  const { uploadStates } = useUploadStates();
  const { queueStats } = useQueueStats();
  const { unfinishedUploads } = useUnfinishedUploads();

  return {
    ...actions,
    ...state,
    uploadStates,
    queueStats,
    unfinishedUploads,
  };
}
