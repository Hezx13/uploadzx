import { useCallback, useMemo } from 'react';
import { useUploadzxContext } from '../components/UploadzxProvider';

/**
 * Custom hook for queue management actions
 * Provides memoized queue control functions and computed states
 */
export function useQueueActions() {
  const { 
    pauseAll, 
    resumeAll, 
    cancelAll, 
    queueStats,
    pickAndUploadFiles 
  } = useUploadzxContext();

  // Memoize action callbacks
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

  // Memoize computed states
  const canPauseAll = useMemo(() => queueStats.activeCount > 0, [queueStats.activeCount]);
  const hasActiveUploads = useMemo(() => queueStats.activeCount > 0, [queueStats.activeCount]);
  const hasQueuedUploads = useMemo(() => queueStats.queueLength > 0, [queueStats.queueLength]);

  const queueStatsText = useMemo(() => 
    `${queueStats.queueLength} in queue, ${queueStats.activeCount} active`,
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