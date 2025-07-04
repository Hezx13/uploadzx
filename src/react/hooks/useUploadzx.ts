import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const mountedRef = useRef<boolean>(true);
  const events: UploadEvents = useMemo(() => ({
    onProgress: options.onProgress,
    onStateChange: (state: UploadState) => {
      if (mountedRef.current) {
        setUploadStates((prev: Record<string, UploadState>) => ({ ...prev, [state.fileId]: state }));
        if (unfinishedUploads.find(upload => upload.id === state.fileId)) {
          setUnfinishedUploads((prev) => {
            const newUnfinishedUploads = prev.filter(upload => upload.id !== state.fileId);
            return newUnfinishedUploads;
          });
        }
        options.onStateChange?.(state);
      }
    },
    onComplete: options.onComplete,
    onError: options.onError,
    onCancel: options.onCancel,
  }), [options.onProgress, options.onStateChange, options.onComplete, options.onError, options.onCancel]);

  useEffect(() => {
    // fix for strict mode
    mountedRef.current = true;
    
    const initializeUploadzx = async () => {
      if (uploadzxRef.current) {
        return;
      }

      uploadzxRef.current = new Uploadzx({
        ...options,
        onInit: async () => {
          console.log('onInit prop');
          if (mountedRef.current) {
            setIsInitialized(true);
            
            // Fetch unfinished uploads after initialization
            if (uploadzxRef.current) {
              try {
                const uploads = await uploadzxRef.current.getUnfinishedUploads();
                if (mountedRef.current) {
                  console.log('uploads', uploads);
                  setUnfinishedUploads(uploads);
                  
                  const stats = uploadzxRef.current.getQueueStats();
                  setQueueStats(stats);
                }
              } catch (error) {
                console.error('Error fetching unfinished uploads:', error);
              }
            }
          }
          options.onInit?.();
        },
      }, events);
    };

    initializeUploadzx();

    // Cleanup function
    return () => {
      mountedRef.current = false;
      if (uploadzxRef.current) {
        uploadzxRef.current = null;
      }
      setIsInitialized(false);
      setUploadStates({});
      setQueueStats({ queueLength: 0, activeCount: 0 });
      setUnfinishedUploads([]);
    };
  }, []); // Empty dependency array - only run once per mount

  useEffect(() => {
    console.log('mount');
    return () => {
      console.log('unmount');
    };
  }, []);

  useEffect(() => {
    console.log('isInitialized', isInitialized);
  }, [isInitialized]);

  useEffect(() => {
    console.log('uploadStates', uploadStates);
  }, [uploadStates]);

  useEffect(() => {
    console.log('queueStats', queueStats);
  }, [queueStats]);

  useEffect(() => {
    console.log('unfinishedUploads', unfinishedUploads);
  }, [unfinishedUploads]);

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

  const clearCompletedUploads = useCallback(() => {
    if (!uploadzxRef.current) return;
    uploadzxRef.current.clearCompletedUploads();
    setUploadStates({});
  }, []);

  const restoreUnfinishedUpload = useCallback(async (fileHandleOrId: StoredFileHandle | string) => {
    if (!uploadzxRef.current) return;
    await uploadzxRef.current.restoreUnfinishedUpload(fileHandleOrId);
    setUnfinishedUploads((prev) => {
      if (typeof fileHandleOrId === 'string') {
        const newUnfinishedUploads = prev.filter(upload => upload.id !== fileHandleOrId);
        return newUnfinishedUploads;
      }
        const newUnfinishedUploads = prev.filter(upload => upload.id !== fileHandleOrId.id);
        return newUnfinishedUploads;
    });
  }, []);

  const value = useMemo(() => {
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
      clearCompletedUploads,
    };
  },  [isInitialized, uploadStates, queueStats, unfinishedUploads, pickAndUploadFiles, pickFiles, addFiles, startUploads, pauseAll, resumeAll, cancelAll, pauseUpload, resumeUpload, cancelUpload, getUploadState, getAllStates, restoreUnfinishedUpload, clearCompletedUploads]);

  return value;
}

export default useUploadzx;