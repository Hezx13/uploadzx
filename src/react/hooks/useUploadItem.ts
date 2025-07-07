import { useCallback, useMemo } from 'react';
import { useUploadzxActions } from '../components/UploadzxProvider';
import { useUploadState } from './useUploadState';

export function useUploadItem(fileId: string) {
  const state = useUploadState(fileId);
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

  const canPause = useMemo(() => {
    if (!state) return false;
    return state.status === 'uploading';
  }, [state?.status]);

  const canResume = useMemo(() => {
    if (!state) return false;
    return state.status === 'paused';
  }, [state?.status]);

  const canCancel = useMemo(() => {
    if (!state) return false;
    return state.status !== 'completed' && state.status !== 'cancelled';
  }, [state?.status]);

  const progress = useMemo(() => state?.progress, [state?.progress?.bytesUploaded]);

  return {
    handlePause,
    handleResume,
    handleCancel,
    canPause,
    canResume,
    canCancel,
    progress,
  };
}
