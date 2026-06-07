import type { Logger } from '../utils';

/**
 * Opaque, driver-defined checkpoint for resuming.
 * Persisted verbatim by the queue and passed back to the driver on resume.
 */
export type ResumeData = Record<string, unknown>;

/**
 * Context passed to a driver when creating a new upload session.
 * Provides file info, optional prior resume checkpoint, abort signal for cancellation,
 * and a logger for debug output.
 */
export interface UploadDriverContext<R extends ResumeData = ResumeData> {
  /** Unique identifier for this file in the queue */
  fileId: string;
  /** The File object to upload */
  file: File;
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** File MIME type */
  type: string;
  /** Prior resume checkpoint (if resuming a paused/failed upload) */
  resume?: R;
  /** Abort signal for cooperative cancellation */
  signal: AbortSignal;
  /** Logger for debug output */
  logger: Logger;
}

/**
 * Result returned by a driver on successful upload completion.
 */
export interface UploadResult {
  /** Canonical URL of the uploaded object (if the transport exposes one) */
  url?: string;
  /** Raw transport response for advanced consumers */
  response?: unknown;
}

/**
 * Callbacks invoked by the driver to report upload progress and state changes.
 *
 * Note: there is intentionally no `onError` callback. A session reports failure
 * by rejecting the promise returned from `start()`. Keeping a single error
 * channel avoids the double-dispatch bug where an error is both signalled via a
 * callback and surfaced via rejection.
 */
export interface UploadDriverHandlers<R extends ResumeData = ResumeData> {
  /** Report bytes uploaded (typically called on each chunk) */
  onProgress(bytesUploaded: number): void;
  /** Report a resumable checkpoint for persistence. No-op for non-resumable drivers. */
  onCheckpoint(resume: R): void;
  /** Report successful completion */
  onSuccess(result: UploadResult): void;
}

/**
 * A live, controllable transfer of a single file.
 * Created by a driver and controlled by the upload engine (UploadController).
 */
export interface UploadSession {
  /** Begin or resume the upload. Resolves on completion, rejects on error. */
  start(): Promise<void>;
  /** Pause the in-flight transfer, preserving the checkpoint for later resume. Idempotent. */
  pause(): Promise<void>;
}

/**
 * Pluggable transport strategy: tus, S3, Azure Blob Storage, plain HTTP PUT, etc.
 * Each driver implementation handles protocol-specific details; the engine handles
 * state, progress tracking, and event emission.
 */
export interface UploadDriver<R extends ResumeData = ResumeData> {
  /** Human-readable name (e.g., "tus", "s3", "httpPut") for logging and identification */
  readonly name: string;
  /**
   * Whether this transport can resume an interrupted transfer from a prior
   * checkpoint. When `false`, the engine treats a "resume" as a restart from
   * byte 0 and will not advertise the upload as resumable. Drivers that set this
   * to `true` MUST emit a checkpoint (via `onCheckpoint`) during `pause()` so the
   * transfer can later be continued.
   */
  readonly resumable: boolean;
  /**
   * Create a new upload session for the given file.
   * The driver should initialize any protocol-specific state, but NOT start the transfer.
   * The returned session's start() method will be called to begin/resume.
   */
  createSession(ctx: UploadDriverContext<R>, handlers: UploadDriverHandlers<R>): UploadSession;
}
