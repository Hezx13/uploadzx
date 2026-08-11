/**
 * Public entry for uploadzx/fs — browser filesystem access independent of uploads.
 */
export { FileSystemManager } from './FileSystemManager';
export { FsStore } from './store/FsStore';
export { PermissionManager } from './permissions/PermissionManager';
export { DirectoryPicker } from './access/DirectoryPicker';
export { Saver } from './access/Saver';
export { pickFiles, pickFromDragEvent, walkDirectory } from './access/pick';
export { FileWatcher } from './watch/FileWatcher';
export { createMetadataReader, getDefaultMetadataReader } from './image/metadata';
export type { MetadataReader } from './image/metadata';
export { createThumbnailer, ThumbnailCache } from './image/thumbnails';
export type { Thumbnailer, ThumbnailOptions } from './image/thumbnails';

export type {
  FsEntry,
  FsRecord,
  FsEventMap,
  FsManagerOptions,
  FsStoreOptions,
  FsPermissionMode,
  ImageMetadata,
  ImageDimensions,
  PermissionResult,
} from './types';

export type { StorageAdapter } from './store/types';
export { DB_VERSION, migrations } from './store/migrations';

export {
  recordToEntry,
  createRecordFromHandle,
  isRawFileName,
  isImageMime,
  joinPath,
} from './utils';

// RAW decoding lives behind uploadzx/fs/raw (lazy wasm, not in core bundle).
export type { RawDecoder, RawDecodeResult, RawDecoderOptions } from './raw/index';
