import { useEffect, useState } from 'react';
import type { UploadState } from '../../types';

export function useUploadState(
  uploadStates: Record<string, UploadState>,
  fileId: string
): UploadState | null {
  const [state, setState] = useState<UploadState | null>(null);

  useEffect(() => {
    setState(uploadStates[fileId] || null);
  }, [uploadStates, fileId]);

  return state;
} 