import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { UploadState } from '../../types';
import { useUploadStore } from '../components/UploadzxProvider';

/**
 * Subscribes to a single file's upload state. Only re-renders when *this* file
 * changes — not when any other upload makes progress.
 */
export function useUploadState(fileId: string): UploadState | null {
  const store = useUploadStore();

  const subscribe = useMemo(() => store.subscribeFile(fileId), [store, fileId]);
  const getSnapshot = useCallback(() => store.getState(fileId), [store, fileId]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
