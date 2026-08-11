// React hooks and components for uploadzx
export {
  useUploadzx,
  type UseUploadzxResult,
  type UseUploadzxOptions,
} from './hooks/useUploadzx';
export { useUploadState, useUploadSelector } from './hooks/useUploadState';
export { useUploadProgress, useUploadStatus } from './hooks/useUploadProgress';
export { useStoreSelector } from './hooks/useStoreSelector';
export { useFilePicker } from './hooks/useFilePicker';
export {
  useFileSystemManager,
  useFsPermissions,
  useFsEntries,
} from './hooks/useFileSystem';
export { useUploadItem } from './hooks/useUploadItem';
export { useQueueActions } from './hooks/useQueueActions';
export {
  UploadzxProvider,
  useUploadzxContext,
  useUploadzxState,
  useUploadStates,
  useUploadStore,
  useQueueStats,
  useUnfinishedUploads,
  useUploadzxActions,
  type UploadzxActions,
} from './components/UploadzxProvider';
export { UploadDropzone } from './components/UploadDropzone';
export { UploadStore, type QueueStats } from './UploadStore';

// Re-export core types for convenience
export type {
  UploadFile,
  UploadProgress,
  UploadState,
  UploadOptions,
  UploadEvents,
  FilePickerOptions,
  StoredFileHandle,
  QueueOptions,
} from '../types';
