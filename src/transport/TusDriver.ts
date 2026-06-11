import {
  UploadDriver,
  UploadDriverContext,
  UploadDriverHandlers,
  UploadSession,
  ResumeData,
} from './types';
import { Upload } from 'tus-js-client';
import type { UploadOptions as TusUploadOptions } from 'tus-js-client';
import { DynamicValue, resolveDynamicValue } from '../utils';

export interface TusDriverOptions {
  endpoint: string;
  chunkSize?: number;
  retryDelays?: number[];
  metadata?: DynamicValue<Record<string, string>>;
  headers?: DynamicValue<Record<string, string>>;
}

export interface TusResumeData extends ResumeData {
  uploadUrl?: string;
}

/**
 * Tus protocol driver for uploadzx.
 * Handles resumable uploads via the tus protocol.
 */
export class TusDriver implements UploadDriver<TusResumeData> {
  readonly name = 'tus';
  readonly resumable = true;
  private options: TusDriverOptions;

  constructor(options: TusDriverOptions) {
    this.options = options;
  }

  createSession(
    ctx: UploadDriverContext<TusResumeData>,
    handlers: UploadDriverHandlers<TusResumeData>
  ): UploadSession {
    return new TusSession(ctx, handlers, this.options);
  }
}

/**
 * A single resumable upload session via the tus protocol.
 */
class TusSession implements UploadSession {
  private ctx: UploadDriverContext<TusResumeData>;
  private handlers: UploadDriverHandlers<TusResumeData>;
  private options: TusDriverOptions;
  private upload?: Upload;
  private previousUploadUrl?: string;

  constructor(
    ctx: UploadDriverContext<TusResumeData>,
    handlers: UploadDriverHandlers<TusResumeData>,
    options: TusDriverOptions
  ) {
    this.ctx = ctx;
    this.handlers = handlers;
    this.options = options;
    this.previousUploadUrl = ctx.resume?.uploadUrl;
  }

  async start(): Promise<void> {
    if (this.ctx.signal.aborted) {
      throw new Error('Upload was aborted');
    }

    // Resolve headers/metadata at request time so long-paused uploads pick up
    // fresh credentials instead of replaying a token captured at construction.
    // Awaited up front so this method is a plain async function rather than an
    // (anti-pattern) async Promise executor.
    const [resolvedHeaders, resolvedMetadata] = await Promise.all([
      resolveDynamicValue(this.options.headers),
      resolveDynamicValue(this.options.metadata),
    ]);

    let resolveDone!: () => void;
    let rejectDone!: (error: Error) => void;
    const done = new Promise<void>((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });

    // When integrity hashing is enabled, advertise the digest as tus metadata
    // (e.g. `checksum: "blake3:<hex>"`) so the server can verify what it stored.
    const integrityMetadata = this.ctx.integrity
      ? {
          [this.ctx.integrity.metadataKey]:
            `${this.ctx.integrity.digest.algorithm}:${this.ctx.integrity.digest.hex}`,
        }
      : undefined;

    const uploadOptions: TusUploadOptions = {
      endpoint: this.options.endpoint,
      // When set (resume), tus issues a HEAD to learn the current offset and
      // continues with PATCH instead of creating a fresh upload.
      uploadUrl: this.previousUploadUrl,
      chunkSize: this.options.chunkSize || 1024 * 1024, // 1MB default
      retryDelays: this.options.retryDelays || [0, 3000, 5000, 10000, 20000],
      metadata: {
        filename: this.ctx.file.name,
        filetype: this.ctx.file.type,
        ...resolvedMetadata,
        ...integrityMetadata,
      },
      headers: resolvedHeaders,
      // uploadzx owns resume bookkeeping: the upload URL is persisted in
      // IndexedDB and replayed via `uploadUrl` above. tus's own localStorage
      // fingerprint store is therefore redundant, and leaving it on leaks a
      // `tus::…` entry into localStorage on every upload/retry. Turn it off.
      storeFingerprintForResuming: false,

      // Surface the upload URL the instant it's known — on creation *or* on
      // resume — so the queue can persist it mid-flight. This is what makes a
      // page refresh during an active upload resume instead of restarting at 0.
      onUploadUrlAvailable: () => {
        const url = this.upload?.url;
        if (url) {
          this.handlers.onCheckpoint({ uploadUrl: url });
        }
      },

      // Failure is reported solely by rejecting `start()`; there is no separate
      // error callback, which avoids double-dispatching the same error.
      onError: (error: Error) => rejectDone(error),

      onProgress: (bytesUploaded: number) => {
        this.handlers.onProgress(bytesUploaded);
      },

      onSuccess: () => {
        const tusUrl = this.upload?.url || undefined;
        if (tusUrl) {
          this.handlers.onCheckpoint({ uploadUrl: tusUrl });
        }
        this.handlers.onSuccess({ url: tusUrl });
        resolveDone();
      },
    };

    this.ctx.signal.addEventListener('abort', () => this.upload?.abort(), { once: true });

    this.upload = new Upload(this.ctx.file, uploadOptions);
    this.upload.start();
    return done;
  }

  async pause(): Promise<void> {
    if (this.upload) {
      // Store the upload URL for resuming
      const uploadUrl = this.upload.url;
      if (uploadUrl) {
        this.handlers.onCheckpoint({ uploadUrl });
      }
      this.upload.abort();
    }
  }
}

/**
 * Factory function to create a TusDriver with the given options.
 */
export function tus(options: TusDriverOptions): UploadDriver<TusResumeData> {
  return new TusDriver(options);
}
