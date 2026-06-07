import type { UploadProgress, UploadStatus } from '../../types';
import { useUploadSelector } from './useUploadState';

/**
 * Subscribe to a single file's progress. Re-renders only on that file's progress
 * changes — not on any other file, and not on this file's non-progress changes.
 *
 * Note: the signature changed from `(uploadStates, fileId)` to `(fileId)`. The
 * old form forced you to read the entire states record (via `useUploadStates`),
 * which re-renders on every tick of every file. This form subscribes granularly.
 */
export function useUploadProgress(fileId: string): UploadProgress | null {
  return useUploadSelector(fileId, s => s?.progress ?? null);
}

/**
 * Subscribe to just a file's status. A component that only renders controls
 * (pause/resume/cancel) can use this and avoid re-rendering on progress ticks.
 */
export function useUploadStatus(fileId: string): UploadStatus | null {
  return useUploadSelector(fileId, s => s?.status ?? null);
}
