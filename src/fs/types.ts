import type { IntegrityDigest } from '../types';

export type FsHandleKind = 'file' | 'directory';
export type FsPermissionMode = 'read' | 'readwrite';

export interface FsEntry {
  id: string;
  kind: FsHandleKind;
  name: string;
  relPath?: string;
  size?: number;
  type?: string;
  lastModified?: number;
  file?: File;
  handle?: FileSystemHandle;
  parentId?: string;
  hash?: IntegrityDigest;
}

export interface FsRecord {
  id: string;
  schemaVersion: number;
  kind: FsHandleKind;
  name: string;
  relPath?: string;
  size?: number;
  type?: string;
  lastModified?: number;
  handle?: FileSystemHandle;
  parentId?: string;
  hash?: IntegrityDigest;
  cachedBytesKey?: string;
  thumbKey?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PermissionResult {
  granted: FileSystemHandle[];
  pending: FileSystemHandle[];
  denied: FileSystemHandle[];
}

export interface FsStoreOptions {
  dbName?: string;
  /** Max bytes to cache per file on Safari/Firefox (default 50 MiB). */
  maxCachedFileBytes?: number;
  /** Max total bytes for thumbnail cache (default 100 MiB). */
  thumbCacheBudgetBytes?: number;
  debug?: boolean;
}

export interface FsManagerOptions extends FsStoreOptions {
  filePicker?: {
    accept?: string;
    multiple?: boolean;
    useFileSystemAccess?: boolean;
  };
  /** Poll interval for watcher fallback in ms (default 5000). */
  watchPollIntervalMs?: number;
  /** Re-hash files on watch when size/mtime unchanged but content may differ. */
  watchVerifyHash?: boolean;
}

export interface ImageDimensions {
  width: number;
  height: number;
  orientation?: number;
}

export interface ImageMetadata {
  dimensions?: ImageDimensions;
  exif?: Record<string, unknown>;
  iptc?: Record<string, unknown>;
  xmp?: Record<string, unknown>;
  isRaw?: boolean;
}

export interface FsEventMap {
  permissionchange: (pending: FileSystemHandle[]) => void;
  add: (entry: FsEntry) => void;
  change: (entry: FsEntry) => void;
  remove: (id: string) => void;
  error: (error: Error) => void;
  [key: string]: (...args: any[]) => void;
}

export const CURRENT_RECORD_SCHEMA_VERSION = 1;
