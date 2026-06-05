import type { UploadProgress, UploadState } from '../../types';

/**
 * Derives a file's progress from an upload-states record. Computed directly —
 * no effect, no extra render. For a live single-file subscription prefer
 * `useUploadState(fileId)?.progress`.
 */
export function useUploadProgress(
  uploadStates: Record<string, UploadState>,
  fileId: string
): UploadProgress | null {
  return uploadStates[fileId]?.progress ?? null;
}
