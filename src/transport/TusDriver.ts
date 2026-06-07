import {
  UploadDriver,
  UploadDriverContext,
  UploadDriverHandlers,
  UploadSession,
  ResumeData,
} from './types';
import { Upload, defaultOptions } from 'tus-js-client';
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

    const uploadOptions: TusUploadOptions = {
      endpoint: this.options.endpoint,
      uploadUrl: this.previousUploadUrl, // Use previous URL if resuming
      chunkSize: this.options.chunkSize || 1024 * 1024, // 1MB default
      retryDelays: this.options.retryDelays || [0, 3000, 5000, 10000, 20000],
      metadata: {
        filename: this.ctx.file.name,
        filetype: this.ctx.file.type,
        ...resolvedMetadata,
      },
      headers: resolvedHeaders,
      // Use default fingerprinting for resumable uploads (file size + modification time + name)
      fingerprint: defaultOptions.fingerprint,
      // Ensure fingerprints are stored for resuming
      storeFingerprintForResuming: true,
      removeFingerprintOnSuccess: true,

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

    // If resuming (we have a previous upload URL), try to find and resume the previous upload
    if (this.previousUploadUrl) {
      try {
        const previousUploads = await this.upload.findPreviousUploads();
        this.ctx.logger.debug('Found previous uploads:', previousUploads.length);

        const matchingUpload = previousUploads.find(
          upload => upload.uploadUrl === this.previousUploadUrl
        );

        if (matchingUpload) {
          this.ctx.logger.debug('Resuming from previous upload:', {
            url: matchingUpload.uploadUrl,
            size: matchingUpload.size,
          });
          this.upload.resumeFromPreviousUpload(matchingUpload);
          // Report checkpoint immediately upon resume
          if (matchingUpload.uploadUrl) {
            this.handlers.onCheckpoint({ uploadUrl: matchingUpload.uploadUrl });
          }
        } else {
          this.ctx.logger.warn('Previous upload not found, starting new upload');
        }
      } catch (error) {
        this.ctx.logger.warn('Could not find previous upload, starting new:', error);
        // Continue with new upload if resume fails
      }
    }

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
