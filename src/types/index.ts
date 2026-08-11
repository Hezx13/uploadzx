import type { Logger } from '../utils/logger';
import type { UploadDriver, ResumeData } from '../transport/types';
import type { IntegrityHasher } from '../integrity/IntegrityHasher';

// Re-export transport types
export type { UploadDriver, ResumeData } from '../transport/types';

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
  url?: string;
  file: File;
  /**
   * Content digest of the file, present once integrity hashing is enabled and the
   * pre-upload hash pass has completed. See {@link IntegrityOptions}.
   */
  integrity?: IntegrityDigest;
}

/** Hashing algorithm used for integrity digests. */
export type IntegrityAlgorithm = 'blake3' | 'sha-256';

/**
 * A computed content digest. `hex` is the lowercase-hex encoding of the raw
 * digest produced by `algorithm`.
 */
export interface IntegrityDigest {
  algorithm: IntegrityAlgorithm;
  hex: string;
}

/**
 * Opt-in streaming integrity hashing. When set on {@link QueueOptions}, each
 * file is hashed once (in a Web Worker, in constant memory) before upload and
 * the digest is reused for resume verification, the tus checksum metadata, and
 * dedup. Absent this option, no hashing code or wasm is loaded.
 */
export interface IntegrityOptions {
  /** Digest algorithm. Defaults to `'blake3'`. */
  algorithm?: IntegrityAlgorithm;
  /**
   * Re-hash a restored file and compare against the persisted digest before
   * resuming, dropping the record on mismatch. Defaults to `true`.
   */
  verifyResume?: boolean;
  /**
   * Send the digest to the server as upload metadata (tus) for end-to-end
   * integrity. Defaults to `true`.
   */
  sendToServer?: boolean;
  /**
   * Metadata key under which the digest is sent, formatted as
   * `"<algorithm>:<hex>"`. Defaults to `'checksum'`.
   */
  metadataKey?: string;
  /**
   * Skip uploading a file whose digest matches one already completed/known this
   * session, short-circuiting it to `completed`. Defaults to `true`.
   */
  dedup?: boolean;
  /** File slice size fed to the hasher, in bytes. Defaults to 8 MiB. */
  chunkSize?: number;
  /**
   * Provide the Worker yourself (escape hatch for bundlers that can't resolve
   * the default `new URL('...', import.meta.url)` worker reference).
   */
  workerFactory?: () => Worker;
  /**
   * Inject a custom hasher implementation. Defaults to a lazily-loaded
   * worker-backed wasm hasher. Primarily useful for tests.
   */
  hasher?: IntegrityHasher;
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
  /** Validation enforced before a file enters the queue. */
  validation?: FileValidationOptions;
  /** Enable verbose internal logging. Off by default. */
  debug?: boolean;
  /** Custom log sink. Overrides the default console logger. */
  logger?: Partial<Logger>;
  onInit?: () => void;
}

export interface QueueOptions {
  /** The transport strategy (tus, S3, HTTP PUT, etc.) */
  driver: UploadDriver;
  /** Maximum number of concurrent uploads. Defaults to 3. */
  maxConcurrent?: number;
  /** Automatically start queued uploads when the queue is created. Defaults to false. */
  autoStart?: boolean;
  /** Validation enforced before a file enters the queue. */
  validation?: FileValidationOptions;
  /** Enable verbose internal logging. Off by default. */
  debug?: boolean;
  /** Custom log sink. Overrides the default console logger. */
  logger?: Partial<Logger>;
  /** Callback invoked after the queue is initialized and ready. */
  onInit?: () => void;
  /** Persistence adapter for resumable upload bookkeeping. */
  store?: PersistenceAdapter;
  /** TTL for persisted upload records in milliseconds. Defaults to 7 days. */
  persistenceTtlMs?: number;
  /** Enable upload speed tracking. Defaults to false. */
  trackSpeed?: boolean;
  /**
   * Automatically drop an upload's in-memory bookkeeping once it completes,
   * releasing the retained `File` (and its blob backing) instead of holding it
   * until `clearCompletedUploads()` is called. Defaults to `true`.
   *
   * When enabled, completed uploads are no longer returned by `getAllStates()` /
   * `getUploadState()`; observe completion via the `complete`/`stateChange`
   * events (the React store retains completed state independently). Set to
   * `false` to keep the previous behavior of retaining completed uploaders.
   */
  autoEvictCompleted?: boolean;
  /**
   * Opt-in streaming integrity hashing (BLAKE3 / SHA-256) in a Web Worker. When
   * provided, each file is hashed once before upload and the digest powers
   * resume verification, the tus checksum metadata, and dedup. Omit to load no
   * hashing code at all.
   */
  integrity?: IntegrityOptions;
}

export interface UploadEvents {
  onProgress?: (progress: UploadProgress) => void;
  onStateChange?: (state: UploadState) => void;
  onComplete?: (fileId: string, url: string) => void;
  onError?: (fileId: string, error: Error) => void;
  onCancel?: (fileId: string) => void;
  /** Fired once a file's integrity digest has been computed (pre-upload). */
  onHash?: (fileId: string, digest: IntegrityDigest) => void;
}

/** Event channels for the multi-listener emitter (`on`/`off`/`once`). */
export interface UploadEventMap {
  progress: (progress: UploadProgress) => void;
  stateChange: (state: UploadState) => void;
  complete: (fileId: string, url: string) => void;
  error: (fileId: string, error: Error) => void;
  cancel: (fileId: string) => void;
  /** Emitted with the computed digest once the pre-upload hash pass finishes. */
  hash: (fileId: string, digest: IntegrityDigest) => void;
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
  resumeData?: ResumeData;
  bytesUploaded?: number;
  /** Epoch ms when this record was first persisted. Used for TTL reaping. */
  createdAt?: number;
  /** Persisted content digest, used to verify the file on resume. */
  hash?: IntegrityDigest;
}

/**
 * Transport abstraction. The queue depends on this interface rather than a
 * concrete implementation, so alternative transports (tus, S3 multipart,
 * presigned PUT, etc.) can be injected via `uploaderFactory`.
 */
export interface Uploader {
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;
  getState(): UploadState;
  getResumeData(): ResumeData | undefined;
  canResume(): boolean;
  /** The computed content digest, if integrity hashing is enabled. */
  getIntegrity?(): IntegrityDigest | undefined;
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
  updateFileHandleProgress(
    id: string,
    resumeData: ResumeData | undefined,
    bytesUploaded: number,
    hash?: IntegrityDigest
  ): Promise<void>;
  getFileFromHandleByID(id: string): Promise<File | null>;
  clear(): Promise<void>;
  /** Optional: delete persisted records older than `maxAgeMs`. */
  reapStale?(maxAgeMs: number): Promise<void>;
}
