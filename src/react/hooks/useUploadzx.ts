import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Uploadzx, UploadzxOptions, UploadEvents } from '../../index';
import type { StoredFileHandle, UploadFile, UploadProgress, UploadState } from '../../types';
import { UploadStore } from '../UploadStore';

export interface UseUploadzxOptions extends UploadzxOptions {
  autoStart?: boolean;
  onProgress?: (progress: UploadProgress) => void;
  onStateChange?: (state: UploadState) => void;
  onComplete?: (fileId: string, tusUrl: string) => void;
  onError?: (fileId: string, error: Error) => void;
  onCancel?: (fileId: string) => void;
}

export function useUploadzx(options: UseUploadzxOptions) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [queueStats, setQueueStats] = useState({ queueLength: 0, activeCount: 0 });
  const [unfinishedUploads, setUnfinishedUploads] = useState<StoredFileHandle[]>([]);

  const uploadzxRef = useRef<Uploadzx | null>(null);
  const mountedRef = useRef<boolean>(true);
  // External store for per-file state so components subscribe granularly instead
  // of re-rendering the whole list on every progress tick.
  const storeRef = useRef<UploadStore>();
  if (!storeRef.current) {
    storeRef.current = new UploadStore();
  }
  const store = storeRef.current;

  // Keep the latest user callbacks in a ref so the core's event handlers stay
  // stable (constructed once) without going stale.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const events: UploadEvents = useMemo(
    () => ({
      onProgress: progress => optionsRef.current.onProgress?.(progress),
      onStateChange: (state: UploadState) => {
        if (!mountedRef.current) return;
        store.setState(state);
        setUnfinishedUploads(prev =>
          prev.some(upload => upload.id === state.fileId)
            ? prev.filter(upload => upload.id !== state.fileId)
            : prev
        );
        optionsRef.current.onStateChange?.(state);
      },
      onComplete: (fileId, tusUrl) => optionsRef.current.onComplete?.(fileId, tusUrl),
      onError: (fileId, error) => optionsRef.current.onError?.(fileId, error),
      onCancel: fileId => optionsRef.current.onCancel?.(fileId),
    }),
    [store]
  );

  useEffect(() => {
    mountedRef.current = true;

    if (!uploadzxRef.current) {
      uploadzxRef.current = new Uploadzx(
        {
          ...optionsRef.current,
          onInit: async () => {
            if (!mountedRef.current) return;
            setIsInitialized(true);
            try {
              const uploads = (await uploadzxRef.current?.getUnfinishedUploads()) ?? [];
              if (mountedRef.current) {
                setUnfinishedUploads(uploads);
                const stats = uploadzxRef.current?.getQueueStats();
                if (stats) setQueueStats(stats);
              }
            } catch (error) {
              optionsRef.current.logger?.error?.('Error fetching unfinished uploads:', error);
            }
            optionsRef.current.onInit?.();
          },
        },
        events
      );
    }

    return () => {
      mountedRef.current = false;
      uploadzxRef.current = null;
      store.clear();
      setIsInitialized(false);
      setQueueStats({ queueLength: 0, activeCount: 0 });
      setUnfinishedUploads([]);
    };
    // Constructed once; latest callbacks are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncStats = useCallback(() => {
    const stats = uploadzxRef.current?.getQueueStats();
    if (stats) setQueueStats(stats);
  }, []);

  const pickAndUploadFiles = useCallback(async () => {
    if (!uploadzxRef.current) return;
    await uploadzxRef.current.pickAndUploadFiles();
    syncStats();
  }, [syncStats]);

  const pickFiles = useCallback(async () => {
    if (!uploadzxRef.current) return [];
    return uploadzxRef.current.pickFiles();
  }, []);

  const addFiles = useCallback(
    async (files: UploadFile[]) => {
      if (!uploadzxRef.current) return;
      await uploadzxRef.current.addFiles(files);
      syncStats();
    },
    [syncStats]
  );

  const startUploads = useCallback(async () => {
    if (!uploadzxRef.current) return;
    await uploadzxRef.current.startUploads();
    syncStats();
  }, [syncStats]);

  const pauseAll = useCallback(async () => {
    await uploadzxRef.current?.pauseAll();
    syncStats();
  }, [syncStats]);

  const resumeAll = useCallback(async () => {
    await uploadzxRef.current?.resumeAll();
    syncStats();
  }, [syncStats]);

  const cancelAll = useCallback(async () => {
    await uploadzxRef.current?.cancelAll();
    syncStats();
  }, [syncStats]);

  const pauseUpload = useCallback(
    async (fileId: string) => {
      await uploadzxRef.current?.pauseUpload(fileId);
      syncStats();
    },
    [syncStats]
  );

  const resumeUpload = useCallback(
    async (fileId: string) => {
      await uploadzxRef.current?.resumeUpload(fileId);
      syncStats();
    },
    [syncStats]
  );

  const cancelUpload = useCallback(
    async (fileId: string) => {
      await uploadzxRef.current?.cancelUpload(fileId);
      store.remove(fileId);
      syncStats();
    },
    [store, syncStats]
  );

  const getUploadState = useCallback(
    (fileId: string) => uploadzxRef.current?.getUploadState(fileId) ?? null,
    []
  );

  const getAllStates = useCallback(() => uploadzxRef.current?.getAllStates() ?? [], []);

  const clearCompletedUploads = useCallback(() => {
    uploadzxRef.current?.clearCompletedUploads();
  }, []);

  const restoreUnfinishedUpload = useCallback(
    async (fileHandleOrId: StoredFileHandle | string) => {
      if (!uploadzxRef.current) return;
      await uploadzxRef.current.restoreUnfinishedUpload(fileHandleOrId);
      const id = typeof fileHandleOrId === 'string' ? fileHandleOrId : fileHandleOrId.id;
      setUnfinishedUploads(prev => prev.filter(upload => upload.id !== id));
      syncStats();
    },
    [syncStats]
  );

  return useMemo(
    () => ({
      store,
      isInitialized,
      queueStats,
      unfinishedUploads,
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
      restoreUnfinishedUpload,
      clearCompletedUploads,
    }),
    [
      store,
      isInitialized,
      queueStats,
      unfinishedUploads,
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
      restoreUnfinishedUpload,
      clearCompletedUploads,
    ]
  );
}

export default useUploadzx;
