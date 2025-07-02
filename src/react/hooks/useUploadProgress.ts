import { useEffect, useState } from 'react';
import type { UploadProgress } from '../../types';

export function useUploadProgress(
  uploadStates: Record<string, any>,
  fileId: string
): UploadProgress | null {
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  useEffect(() => {
    const state = uploadStates[fileId];
    if (state?.progress) {
      setProgress(state.progress);
    } else {
      setProgress(null);
    }
  }, [uploadStates, fileId]);

  return progress;
} 