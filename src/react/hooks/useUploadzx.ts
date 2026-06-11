import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Uploadzx, UploadzxOptions } from '../../index';
import type {
  IntegrityDigest,
  StoredFileHandle,
  UploadFile,
  UploadProgress,
  UploadState,
} from '../../types';
import { UploadStore } from '../UploadStore';

export interface UseUploadzxOptions extends UploadzxOptions {
  autoStart?: boolean;
  onProgress?: (progress: UploadProgress) => void;
  onStateChange?: (state: UploadState) => void;
  onComplete?: (fileId: string, url: string) => void;
  onError?: (fileId: string, error: Error) => void;
  onCancel?: (fileId: string) => void;
  /** Fired once a file's integrity digest has been computed (pre-upload). */
  onHash?: (fileId: string, digest: IntegrityDigest) => void;
}

/**
 * Stable action surface for an Uploadzx instance. Every method keeps a stable
 * identity for the lifetime of the hook, so it can live in context without ever
 * causing a re-render.
 */
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

export interface UseUploadzxResult {
  store: UploadStore;
  actions: UploadzxActions;
}

/**
 * Owns a single Uploadzx core instance and the external {@link UploadStore} that
 * mirrors its reactive state. All store updates are driven by the core's event
 * emitter (the single source of truth), so derived values like queue stats can
 * never go stale the way a pull-based "sync after each action" approach does.
 *
 * Returns only stable references (`store`, `actions`). Dynamic state is read
 * through the store via selector hooks, not returned from here — so nothing that
 * consumes this hook re-renders on a progress tick.
 */
export function useUploadzx(options: UseUploadzxOptions): UseUploadzxResult {
  // One store per hook instance, created lazily and kept for the lifetime.
  const storeRef = useRef<UploadStore>();
  if (!storeRef.current) {
    storeRef.current = new UploadStore();
  }
  const store = storeRef.current;

  const coreRef = useRef<Uploadzx | null>(null);

  // Latest user callbacks behind a ref so the core (and its listeners) are
  // constructed exactly once without going stale.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let disposed = false;

    const core = new Uploadzx({
      ...optionsRef.current,
      onInit: async () => {
        if (disposed) return;
        store.setInitialized(true);
        try {
          const uploads = (await core.getUnfinishedUploads()) ?? [];
          if (!disposed) {
            store.setUnfinished(uploads);
            store.setStats(core.getQueueStats());
          }
        } catch (error) {
          optionsRef.current.logger?.error?.('Error fetching unfinished uploads:', error);
        }
        optionsRef.current.onInit?.();
      },
    });
    coreRef.current = core;

    const syncStats = () => store.setStats(core.getQueueStats());

    // Event-driven: the core emitter is the single source of truth. Each handler
    // updates the store and forwards to the user's callback. Stats are recomputed
    // on every relevant event, so they stay correct even when the queue advances
    // itself (e.g. a completion frees a slot for a queued upload).
    const unsubscribers = [
      core.on('progress', progress => optionsRef.current.onProgress?.(progress)),
      core.on('stateChange', state => {
        store.setState(state);
        // Once a file is in the active set it's no longer a pending "unfinished".
        store.removeUnfinished(state.fileId);
        syncStats();
        optionsRef.current.onStateChange?.(state);
      }),
      core.on('complete', (fileId, url) => {
        // Keep the completed state in the store so the UI can show history
        // (a "done" row, a completed count). The core has already evicted its
        // own execution state; the consumer reclaims this via
        // `clearCompletedUploads()`. The preceding `stateChange` already wrote
        // the completed state, so there's nothing to set here.
        syncStats();
        optionsRef.current.onComplete?.(fileId, url);
      }),
      core.on('error', (fileId, error) => {
        syncStats();
        optionsRef.current.onError?.(fileId, error);
      }),
      core.on('cancel', fileId => {
        store.remove(fileId);
        syncStats();
        optionsRef.current.onCancel?.(fileId);
      }),
      core.on('hash', (fileId, digest) => {
        optionsRef.current.onHash?.(fileId, digest);
      }),
    ];

    return () => {
      disposed = true;
      unsubscribers.forEach(off => off());
      core.destroy();
      coreRef.current = null;
      store.reset();
    };
    // Constructed once; latest callbacks are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  // --- actions (stable identities) -----------------------------------------

  const pickAndUploadFiles = useCallback(async () => {
    await coreRef.current?.pickAndUploadFiles();
  }, []);

  const pickFiles = useCallback(async () => coreRef.current?.pickFiles() ?? [], []);

  const addFiles = useCallback(async (files: UploadFile[]) => {
    await coreRef.current?.addFiles(files);
  }, []);

  const startUploads = useCallback(async () => {
    await coreRef.current?.startUploads();
  }, []);

  const pauseAll = useCallback(async () => {
    await coreRef.current?.pauseAll();
  }, []);

  const resumeAll = useCallback(async () => {
    await coreRef.current?.resumeAll();
  }, []);

  const cancelAll = useCallback(async () => {
    await coreRef.current?.cancelAll();
  }, []);

  const pauseUpload = useCallback(async (fileId: string) => {
    await coreRef.current?.pauseUpload(fileId);
  }, []);

  const resumeUpload = useCallback(async (fileId: string) => {
    await coreRef.current?.resumeUpload(fileId);
  }, []);

  const cancelUpload = useCallback(async (fileId: string) => {
    await coreRef.current?.cancelUpload(fileId);
  }, []);

  const getUploadState = useCallback(
    (fileId: string) => coreRef.current?.getUploadState(fileId) ?? null,
    []
  );

  const getAllStates = useCallback(() => coreRef.current?.getAllStates() ?? [], []);

  const clearCompletedUploads = useCallback(() => {
    coreRef.current?.clearCompletedUploads();
    // Mirror the core's eviction in the UI store so cleared rows actually leave
    // the screen and their retained Files are released.
    const record = store.getRecordSnapshot();
    for (const id of Object.keys(record)) {
      const status = record[id].status;
      if (status === 'completed' || status === 'cancelled') {
        store.remove(id);
      }
    }
  }, [store]);

  const restoreUnfinishedUpload = useCallback(
    async (fileHandleOrId: StoredFileHandle | string) => {
      await coreRef.current?.restoreUnfinishedUpload(fileHandleOrId);
      const id = typeof fileHandleOrId === 'string' ? fileHandleOrId : fileHandleOrId.id;
      store.removeUnfinished(id);
    },
    [store]
  );

  const actions = useMemo<UploadzxActions>(
    () => ({
      pickAndUploadFiles,
      pickFiles,
      addFiles,
      startUploads,
      pauseAll,
      resumeAll,
      cancelAll,
      pauseUpload,
      resumeUpload,
      cancelUpload,
      getUploadState,
      getAllStates,
      clearCompletedUploads,
      restoreUnfinishedUpload,
    }),
    [
      pickAndUploadFiles,
      pickFiles,
      addFiles,
      startUploads,
      pauseAll,
      resumeAll,
      cancelAll,
      pauseUpload,
      resumeUpload,
      cancelUpload,
      getUploadState,
      getAllStates,
      clearCompletedUploads,
      restoreUnfinishedUpload,
    ]
  );

  return useMemo(() => ({ store, actions }), [store, actions]);
}

export default useUploadzx;
