import { useMemo } from 'react';
import type { UploadState } from '../../types';
import { useUploadStore } from '../components/UploadzxProvider';
import { useStoreSelector } from './useStoreSelector';

/**
 * Subscribe to a derived slice of a single file's upload state. Only re-renders
 * when the *selected* value changes (per `isEqual`, default `Object.is`) — not
 * when any other upload makes progress, and not when an unselected field of this
 * file changes.
 *
 * @example
 *   const status = useUploadSelector(id, s => s?.status ?? null);
 */
export function useUploadSelector<T>(
  fileId: string,
  selector: (state: UploadState | null) => T,
  isEqual?: (a: T, b: T) => boolean
): T {
  const store = useUploadStore();
  const subscribe = useMemo(() => store.subscribeFile(fileId), [store, fileId]);
  const getSnapshot = useMemo(() => () => store.getState(fileId), [store, fileId]);
  return useStoreSelector(subscribe, getSnapshot, selector, isEqual);
}

/**
 * Subscribe to a single file's full upload state. Re-renders whenever that file
 * changes (including every progress tick). If you only need part of the state,
 * prefer {@link useUploadSelector}, {@link useUploadStatus}, or
 * {@link useUploadProgress}.
 */
export function useUploadState(fileId: string): UploadState | null {
  return useUploadSelector(fileId, s => s);
}
