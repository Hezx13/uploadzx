import { useCallback, useMemo } from 'react';
import { useUploadzxContext } from '../components/UploadzxProvider';
import type { UploadState } from '../../types';

/**
 * Custom hook for individual upload item management
 * Optimizes re-renders by memoizing callbacks and computed values
 */
export function useUploadItem(fileId: string, state: UploadState) {
  const { pauseUpload, resumeUpload, cancelUpload } = useUploadzxContext();

  // Memoize action callbacks to prevent unnecessary re-renders
  const handlePause = useCallback(() => {
    pauseUpload(fileId);
  }, [pauseUpload, fileId]);

  const handleResume = useCallback(() => {
    resumeUpload(fileId);
  }, [resumeUpload, fileId]);

  const handleCancel = useCallback(() => {
    cancelUpload(fileId);
  }, [cancelUpload, fileId]);

  // Memoize computed values
  const canPause = useMemo(() => state.status === 'uploading', [state.status]);
  const canResume = useMemo(() => state.status === 'paused', [state.status]);
  const canCancel = useMemo(() => 
    state.status !== 'completed' && state.status !== 'cancelled', 
    [state.status]
  );

  const progressPercentage = useMemo(() => 
    state.progress?.percentage?.toFixed(1) || '0.0', 
    [state.progress?.percentage]
  );

  return {
    handlePause,
    handleResume,
    handleCancel,
    canPause,
    canResume,
    canCancel,
    progressPercentage,
  };
} 