import { useCallback, useMemo } from 'react';
import { useUploadzxActions, useQueueStats } from '../components/UploadzxProvider';

export function useQueueActions() {
  const { pauseAll, resumeAll, cancelAll, pickAndUploadFiles } = useUploadzxActions();
  const { queueStats } = useQueueStats();

  const handlePauseAll = useCallback(() => {
    pauseAll();
  }, [pauseAll]);

  const handleResumeAll = useCallback(() => {
    resumeAll();
  }, [resumeAll]);

  const handleCancelAll = useCallback(() => {
    cancelAll();
  }, [cancelAll]);

  const handlePickFiles = useCallback(() => {
    pickAndUploadFiles();
  }, [pickAndUploadFiles]);

  const canPauseAll = useMemo(() => queueStats.activeCount > 0, [queueStats.activeCount]);
  const hasActiveUploads = useMemo(() => queueStats.activeCount > 0, [queueStats.activeCount]);
  const hasQueuedUploads = useMemo(() => queueStats.queueLength > 0, [queueStats.queueLength]);

  const queueStatsText = useMemo(
    () => `${queueStats.queueLength} in queue, ${queueStats.activeCount} active`,
    [queueStats.queueLength, queueStats.activeCount]
  );

  return {
    handlePauseAll,
    handleResumeAll,
    handleCancelAll,
    handlePickFiles,
    canPauseAll,
    hasActiveUploads,
    hasQueuedUploads,
    queueStatsText,
    queueStats,
  };
}
