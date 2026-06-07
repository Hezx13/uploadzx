import { useCallback, useMemo } from 'react';
import { useUploadzxActions } from '../components/UploadzxProvider';
import { useUploadStatus } from './useUploadProgress';
import { useUploadProgress } from './useUploadProgress';

/**
 * Everything a single upload row needs: stable control handlers, capability
 * flags derived from status, and live progress.
 *
 * Subscriptions are granular — status and progress are read separately. A row
 * that wants to skip progress re-renders entirely can instead use
 * `useUploadStatus(fileId)` plus `useUploadzxActions()` directly.
 */
export function useUploadItem(fileId: string) {
  const status = useUploadStatus(fileId);
  const progress = useUploadProgress(fileId);
  const { pauseUpload, resumeUpload, cancelUpload } = useUploadzxActions();

  const handlePause = useCallback(() => {
    pauseUpload(fileId);
  }, [pauseUpload, fileId]);

  const handleResume = useCallback(() => {
    resumeUpload(fileId);
  }, [resumeUpload, fileId]);

  const handleCancel = useCallback(() => {
    cancelUpload(fileId);
  }, [cancelUpload, fileId]);

  const canPause = status === 'uploading';
  const canResume = status === 'paused';
  const canCancel = status !== null && status !== 'completed' && status !== 'cancelled';

  return useMemo(
    () => ({
      status,
      handlePause,
      handleResume,
      handleCancel,
      canPause,
      canResume,
      canCancel,
      progress: progress ?? undefined,
    }),
    [status, handlePause, handleResume, handleCancel, canPause, canResume, canCancel, progress]
  );
}
