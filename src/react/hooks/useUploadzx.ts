import { useCallback, useEffect, useRef, useState } from 'react';
import { Uploadzx, UploadzxOptions, UploadEvents } from '../../index';
import type { StoredFileHandle, UploadFile, UploadState } from '../../types';

export interface UseUploadzxOptions extends UploadzxOptions {
  autoStart?: boolean;
  onProgress?: (progress: any) => void;
  onStateChange?: (state: UploadState) => void;
  onComplete?: (fileId: string, tusUrl: string) => void;
  onError?: (fileId: string, error: Error) => void;
  onCancel?: (fileId: string) => void;
}

export function useUploadzx(options: UseUploadzxOptions) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const [queueStats, setQueueStats] = useState({ queueLength: 0, activeCount: 0 });
  const [unfinishedUploads, setUnfinishedUploads] = useState<StoredFileHandle[]>([]);
  const uploadzxRef = useRef<Uploadzx | null>(null);

  const events: UploadEvents = {
    onProgress: options.onProgress,
    onStateChange: (state: UploadState) => {
      setUploadStates((prev: Record<string, UploadState>) => ({ ...prev, [state.fileId]: state }));
      options.onStateChange?.(state);
    },
    onComplete: options.onComplete,
    onError: options.onError,
    onCancel: options.onCancel,
  };

  useEffect(() => {
    uploadzxRef.current = new Uploadzx(options, events);
    setIsInitialized(true);
  }, []);

  // useEffect(() => {
  //   return () => {
  //     uploadzxRef.current?.cancelAll();
  //   };
  // }, []);

  useEffect(() => {
    if (isInitialized && uploadzxRef.current) {
      const updateStats = () => {
        const stats = uploadzxRef.current!.getQueueStats();
        setQueueStats(stats);
        uploadzxRef.current!.getUnfinishedUploads().then(uploads => {
          setUnfinishedUploads(uploads);
        });
      };

      updateStats();
      const interval = setInterval(updateStats, 100);
      return () => clearInterval(interval);
    }
  }, [isInitialized]);

  const pickAndUploadFiles = useCallback(async () => {
    if (!uploadzxRef.current) return;
    await uploadzxRef.current.pickAndUploadFiles();
  }, []);

  const pickFiles = useCallback(async () => {
    if (!uploadzxRef.current) return [];
    return await uploadzxRef.current.pickFiles();
  }, []);

  const addFiles = useCallback(async (files: UploadFile[]) => {
    if (!uploadzxRef.current) return;
    await uploadzxRef.current.addFiles(files);
  }, []);

  const startUploads = useCallback(async () => {
    if (!uploadzxRef.current) return;
    await uploadzxRef.current.startUploads();
  }, []);

  const pauseAll = useCallback(async () => {
    if (!uploadzxRef.current) return;
    await uploadzxRef.current.pauseAll();
  }, []);

  const resumeAll = useCallback(async () => {
    if (!uploadzxRef.current) return;
    await uploadzxRef.current.resumeAll();
  }, []);

  const cancelAll = useCallback(async () => {
    if (!uploadzxRef.current) return;
    await uploadzxRef.current.cancelAll();
  }, []);

  const pauseUpload = useCallback(async (fileId: string) => {
    if (!uploadzxRef.current) return;
    await uploadzxRef.current.pauseUpload(fileId);
  }, []);

  const resumeUpload = useCallback(async (fileId: string) => {
    if (!uploadzxRef.current) return;
    await uploadzxRef.current.resumeUpload(fileId);
  }, []);

  const cancelUpload = useCallback(async (fileId: string) => {
    if (!uploadzxRef.current) return;
    await uploadzxRef.current.cancelUpload(fileId);
  }, []);

  const getUploadState = useCallback((fileId: string) => {
    if (!uploadzxRef.current) return null;
    return uploadzxRef.current.getUploadState(fileId);
  }, []);

  const getAllStates = useCallback(() => {
    if (!uploadzxRef.current) return {};
    return uploadzxRef.current.getAllStates();
  }, []);

  const restoreUnfinishedUpload = useCallback(async (fileHandleOrId: StoredFileHandle | string) => {
    console.log('restoreUnfinishedUpload', fileHandleOrId);
    if (!uploadzxRef.current) return;
    await uploadzxRef.current.restoreUnfinishedUpload(fileHandleOrId);
  }, []);

  return {
    isInitialized,
    uploadStates,
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
  };
} 