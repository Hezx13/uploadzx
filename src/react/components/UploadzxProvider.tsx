import {
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useCallback,
  useSyncExternalStore,
} from 'react';
import { useUploadzx, UseUploadzxOptions } from '../hooks/useUploadzx';
import type { StoredFileHandle, UploadFile, UploadState } from '../../types';
import type { UploadStore } from '../UploadStore';

export interface UploadzxActions {
  pickAndUploadFiles: () => Promise<void>;
  pickFiles: () => Promise<UploadFile[]>;
  addFiles: (files: UploadFile[]) => Promise<void>;
  startUploads: () => Promise<void>;
  pauseAll: () => Promise<void>;
  resumeAll: () => Promise<void>;
  cancelAll: () => Promise<void>;
  pauseUpload: (fileId: string) => Promise<void>;
  resumeUpload: (fileId: string) => Promise<void>;
  cancelUpload: (fileId: string) => Promise<void>;
  getUploadState: (fileId: string) => UploadState | null;
  getAllStates: () => UploadState[];
  clearCompletedUploads: () => void;
  restoreUnfinishedUpload: (fileHandleOrId: StoredFileHandle | string) => Promise<void>;
}

const UploadzxActionsContext = createContext<UploadzxActions | null>(null);

const UploadzxStateContext = createContext<{
  isInitialized: boolean;
} | null>(null);

/** Provides the external store; per-file/global subscriptions read from it. */
const UploadStoreContext = createContext<UploadStore | null>(null);

const QueueStatsContext = createContext<{
  queueStats: { queueLength: number; activeCount: number };
} | null>(null);

const UnfinishedUploadsContext = createContext<{
  unfinishedUploads: StoredFileHandle[];
} | null>(null);

interface UploadzxProviderProps {
  children: ReactNode;
  options: UseUploadzxOptions;
}

export function UploadzxProvider({ children, options }: UploadzxProviderProps) {
  const uploadzxValue = useUploadzx(options);

  const actionsValue = useMemo<UploadzxActions>(
    () => ({
      pickAndUploadFiles: uploadzxValue.pickAndUploadFiles,
      pickFiles: uploadzxValue.pickFiles,
      addFiles: uploadzxValue.addFiles,
      startUploads: uploadzxValue.startUploads,
      pauseAll: uploadzxValue.pauseAll,
      resumeAll: uploadzxValue.resumeAll,
      cancelAll: uploadzxValue.cancelAll,
      pauseUpload: uploadzxValue.pauseUpload,
      resumeUpload: uploadzxValue.resumeUpload,
      cancelUpload: uploadzxValue.cancelUpload,
      getUploadState: uploadzxValue.getUploadState,
      getAllStates: uploadzxValue.getAllStates,
      clearCompletedUploads: uploadzxValue.clearCompletedUploads,
      restoreUnfinishedUpload: uploadzxValue.restoreUnfinishedUpload,
    }),
    [
      uploadzxValue.pickAndUploadFiles,
      uploadzxValue.pickFiles,
      uploadzxValue.addFiles,
      uploadzxValue.startUploads,
      uploadzxValue.pauseAll,
      uploadzxValue.resumeAll,
      uploadzxValue.cancelAll,
      uploadzxValue.pauseUpload,
      uploadzxValue.resumeUpload,
      uploadzxValue.cancelUpload,
      uploadzxValue.getUploadState,
      uploadzxValue.getAllStates,
      uploadzxValue.clearCompletedUploads,
      uploadzxValue.restoreUnfinishedUpload,
    ]
  );

  const stateValue = useMemo(
    () => ({ isInitialized: uploadzxValue.isInitialized }),
    [uploadzxValue.isInitialized]
  );

  const queueStatsValue = useMemo(
    () => ({ queueStats: uploadzxValue.queueStats }),
    [uploadzxValue.queueStats]
  );

  const unfinishedUploadsValue = useMemo(
    () => ({ unfinishedUploads: uploadzxValue.unfinishedUploads }),
    [uploadzxValue.unfinishedUploads]
  );

  return (
    <UploadzxActionsContext.Provider value={actionsValue}>
      <UploadzxStateContext.Provider value={stateValue}>
        <UploadStoreContext.Provider value={uploadzxValue.store}>
          <QueueStatsContext.Provider value={queueStatsValue}>
            <UnfinishedUploadsContext.Provider value={unfinishedUploadsValue}>
              {children}
            </UnfinishedUploadsContext.Provider>
          </QueueStatsContext.Provider>
        </UploadStoreContext.Provider>
      </UploadzxStateContext.Provider>
    </UploadzxActionsContext.Provider>
  );
}

export function useUploadzxActions() {
  const context = useContext(UploadzxActionsContext);
  if (!context) {
    throw new Error('useUploadzxActions must be used within UploadzxProvider');
  }
  return context;
}

export function useUploadzxState() {
  const context = useContext(UploadzxStateContext);
  if (!context) {
    throw new Error('useUploadzxState must be used within UploadzxProvider');
  }
  return context;
}

/** Access the raw external store (advanced). Prefer `useUploadState(fileId)`. */
export function useUploadStore(): UploadStore {
  const store = useContext(UploadStoreContext);
  if (!store) {
    throw new Error('useUploadStore must be used within UploadzxProvider');
  }
  return store;
}

/**
 * Live record of all upload states. Re-renders on every progress tick by design —
 * for a single row prefer `useUploadState(fileId)`, which subscribes granularly.
 */
export function useUploadStates() {
  const store = useUploadStore();
  const uploadStates = useSyncExternalStore(
    store.subscribeGlobal,
    store.getRecordSnapshot,
    store.getRecordSnapshot
  );
  return { uploadStates };
}

export function useQueueStats() {
  const context = useContext(QueueStatsContext);
  if (!context) {
    throw new Error('useQueueStats must be used within UploadzxProvider');
  }
  return context;
}

export function useUnfinishedUploads() {
  const context = useContext(UnfinishedUploadsContext);
  if (!context) {
    throw new Error('useUnfinishedUploads must be used within UploadzxProvider');
  }
  return context;
}

// TODO: remove later, only for backward compatibility
/**
 * @deprecated Use individual hooks instead: useUploadzxActions, useUploadzxState, useUploadStates, useQueueStats, useUnfinishedUploads
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
