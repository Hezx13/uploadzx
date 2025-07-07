import { useEffect, useState } from 'react';
import type { UploadState } from '../../types';
import { useUploadzxContext } from '../components/UploadzxProvider';

export function useUploadState(fileId: string): UploadState | null {
  const { uploadStates } = useUploadzxContext();
  const [state, setState] = useState<UploadState | null>(null);

  useEffect(() => {
    try {
      const state = uploadStates?.[fileId] || null;
      setState(state);
    } catch (error) {
      console.error('Error getting upload state for fileId:', fileId, error);
    }
  }, [uploadStates, fileId]);

  return state;
}
