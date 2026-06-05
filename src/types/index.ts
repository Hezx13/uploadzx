import type { Logger } from '../utils/logger';

export interface UploadFile {
  id: string;
  file: File;
  fileHandle?: FileSystemFileHandle;
  name: string;
  size: number;
  type: string;
}

export interface UploadProgress {
  fileId: string;
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
  bytesPerSecond: number;
}

export type UploadStatus = 'pending' | 'uploading' | 'paused' | 'completed' | 'error' | 'cancelled';

export interface UploadState {
  fileId: string;
  status: UploadStatus;
  progress: UploadProgress;
  error?: Error;
  tusUrl?: string;
  file: File;
}

/**
 * A value that can be supplied statically or resolved lazily (and possibly
 * asynchronously) at the moment it is needed. Used for headers/metadata so that
 * long-lived resumable uploads can refresh short-lived credentials per request
 * instead of replaying a token captured at construction time.
 */
export type DynamicValue<T> = T | (() => T | Promise<T>);

export interface FileValidationOptions {
  /** Maximum size per file, in bytes. */
  maxSize?: number;
  /** Allowed MIME types. Supports wildcard subtypes like `image/*`. */
  allowedTypes?: string[];
  /** Maximum number of files accepted into the queue at once. */
  maxFiles?: number;
}

export interface UploadOptions {
  endpoint: string;
  chunkSize?: number;
  retryDelays?: number[];
  metadata?: DynamicValue<Record<string, string>>;
  headers?: DynamicValue<Record<string, string>>;
  /** Validation enforced before a file enters the queue. */
  validation?: FileValidationOptions;
  /** Enable verbose internal logging. Off by default. */
  debug?: boolean;
  /** Custom log sink. Overrides the default console logger. */
  logger?: Partial<Logger>;
  onInit?: () => void;
}

export interface UploadEvents {
  onProgress?: (progress: UploadProgress) => void;
  onStateChange?: (state: UploadState) => void;
  onComplete?: (fileId: string, tusUrl: string) => void;
  onError?: (fileId: string, error: Error) => void;
  onCancel?: (fileId: string) => void;
}

/** Event channels for the multi-listener emitter (`on`/`off`/`once`). */
export interface UploadEventMap {
  progress: (progress: UploadProgress) => void;
  stateChange: (state: UploadState) => void;
  complete: (fileId: string, tusUrl: string) => void;
  error: (fileId: string, error: Error) => void;
  cancel: (fileId: string) => void;
  [key: string]: (...args: any[]) => void;
}

export interface FilePickerOptions {
  accept?: string;
  multiple?: boolean;
  useFileSystemAccess?: boolean;
}

export interface StoredFileHandle {
  id: string;
  name: string;
  size: number;
  type: string;
  handle: FileSystemFileHandle;
  lastModified: number;
  tusUploadUrl?: string;
  bytesUploaded?: number;
  /** Epoch ms when this record was first persisted. Used for TTL reaping. */
  createdAt?: number;
}

/**
 * Transport abstraction. The queue depends on this interface rather than a
 * concrete tus implementation, so alternative transports (S3 multipart,
 * presigned PUT, etc.) can be injected via `uploaderFactory`.
 */
export interface Uploader {
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;
  getState(): UploadState;
  getCurrentUploadUrl(): string | undefined;
  canResume(): boolean;
}

/**
 * Persistence abstraction for resumable upload bookkeeping. The default
 * implementation is IndexedDB-backed (`FileHandleStore`), but the queue only
 * depends on this interface so a memory/server-backed store can be swapped in.
 */
export interface PersistenceAdapter {
  storeFileHandle(fileHandle: FileSystemFileHandle, id: string): Promise<void>;
  getFileHandle(id: string): Promise<StoredFileHandle | null>;
  getAllFileHandles(): Promise<StoredFileHandle[]>;
  removeFileHandle(id: string): Promise<void>;
  updateFileHandleProgress(id: string, tusUploadUrl: string, bytesUploaded: number): Promise<void>;
  getFileFromHandleByID(id: string): Promise<File | null>;
  clear(): Promise<void>;
  /** Optional: delete persisted records older than `maxAgeMs`. */
  reapStale?(maxAgeMs: number): Promise<void>;
}
