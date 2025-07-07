import { UploadFile, UploadOptions, UploadEvents, UploadState, UploadProgress } from '../types';
import { Upload, defaultOptions } from 'tus-js-client';
import type { UploadOptions as TusUploadOptions } from 'tus-js-client';
export interface TusUploaderOptions {
  previousUploadUrl?: string;
  previousBytesUploaded?: number;
  trackSpeed?: boolean;
}

export class TusUploader {
  private uploadFile: UploadFile;
  private options: UploadOptions;
  private events: UploadEvents;
  private upload?: Upload;
  private abortController: AbortController;
  private state: UploadState;
  private previousUploadUrl?: string;
  private trackSpeed: boolean;
  private lastProgressUpdate?: {
    bytesUploaded: number;
    timestamp: number;
  };

  constructor(
    uploadFile: UploadFile,
    options: UploadOptions,
    events: UploadEvents = {},
    tusOptions?: TusUploaderOptions
  ) {
    this.uploadFile = uploadFile;
    this.options = options;
    this.events = events;
    this.abortController = new AbortController();
    this.previousUploadUrl = tusOptions?.previousUploadUrl;
    this.trackSpeed = tusOptions?.trackSpeed ?? false;

    const initialBytesUploaded = tusOptions?.previousBytesUploaded || 0;
    const initialPercentage = Math.round((initialBytesUploaded / uploadFile.size) * 100);

    this.state = {
      fileId: uploadFile.id,
      status: this.previousUploadUrl ? 'paused' : 'pending',
      file: uploadFile.file,
      progress: {
        fileId: uploadFile.id,
        bytesUploaded: initialBytesUploaded,
        bytesTotal: uploadFile.size,
        percentage: initialPercentage,
        bytesPerSecond: 0,
      },
    };
  }

  async start(): Promise<void> {
    if (this.state.status === 'uploading') {
      return;
    }

    this.updateState({ status: 'uploading' });

    // Initialize progress tracking only if speed tracking is enabled
    if (this.trackSpeed) {
      this.lastProgressUpdate = {
        bytesUploaded: this.state.progress.bytesUploaded,
        timestamp: Date.now(),
      };
    }

    try {
      await this.startTusUpload();
    } catch (error) {
      this.updateState({
        status: 'error',
        error: error as Error,
      });
      this.events.onError?.(this.uploadFile.id, error as Error);
    }
  }

  async pause(): Promise<void> {
    if (this.upload && this.state.status === 'uploading') {
      // Store the upload URL for resuming
      this.previousUploadUrl = this.upload.url || undefined;
      this.upload.abort();
      this.updateState({ status: 'paused' });

      // Reset progress tracking if speed tracking is enabled
      if (this.trackSpeed) {
        this.lastProgressUpdate = undefined;
      }
    }
  }

  async resume(): Promise<void> {
    if (this.canResume()) {
      console.log(
        `Resuming upload for file: ${this.uploadFile.name}, previousUrl: ${this.previousUploadUrl}`
      );
      this.abortController = new AbortController();
      await this.start();
    }
  }

  async cancel(): Promise<void> {
    if (this.state.status === 'cancelled') {
      return;
    }
    this.abortController.abort();
    if (this.upload) {
      this.upload.abort();
    }
    this.previousUploadUrl = undefined;

    // Reset progress tracking if speed tracking is enabled
    if (this.trackSpeed) {
      this.lastProgressUpdate = undefined;
    }

    this.updateState({ status: 'cancelled' });
    this.events.onCancel?.(this.uploadFile.id);
  }

  getState(): UploadState {
    return { ...this.state };
  }

  getCurrentUploadUrl(): string | undefined {
    return this.upload?.url || this.previousUploadUrl;
  }

  canResume(): boolean {
    return this.state.status === 'paused' || this.state.status === 'error';
  }

  private updateState(updates: Partial<UploadState>): void {
    this.state = { ...this.state, ...updates };
    this.events.onStateChange?.(this.state);
  }

  private updateProgress(bytesUploaded: number): void {
    const percentage = Number(((bytesUploaded / this.uploadFile.size) * 100).toFixed(2));

    let bytesPerSecond = 0;

    if (this.trackSpeed) {
      const now = Date.now();

      if (this.lastProgressUpdate) {
        const timeDiff = (now - this.lastProgressUpdate.timestamp) / 1000;
        const bytesDiff = bytesUploaded - this.lastProgressUpdate.bytesUploaded;
        const shouldUpdateSpeed = timeDiff > 1 && bytesDiff > 0;

        if (shouldUpdateSpeed) {
          bytesPerSecond = Math.round(bytesDiff / timeDiff);
          this.lastProgressUpdate = {
            bytesUploaded,
            timestamp: now,
          };
        } else {
          // Keep previous speed if no significant progress
          bytesPerSecond = this.state.progress.bytesPerSecond;
        }
      }
    }

    const progress: UploadProgress = {
      fileId: this.uploadFile.id,
      bytesUploaded,
      bytesTotal: this.uploadFile.size,
      percentage,
      bytesPerSecond,
    };

    this.updateState({ progress });
    this.events.onProgress?.(progress);
  }

  private async startTusUpload(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const uploadOptions: TusUploadOptions = {
        endpoint: this.options.endpoint,
        uploadUrl: this.previousUploadUrl, // Use previous URL if resuming
        chunkSize: this.options.chunkSize || 1024 * 1024, // 1MB default
        retryDelays: this.options.retryDelays || [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: this.uploadFile.name,
          filetype: this.uploadFile.type,
          ...this.options.metadata,
        },
        headers: this.options.headers,
        // Use default fingerprinting for resumable uploads (file size + modification time + name)
        fingerprint: defaultOptions.fingerprint,
        // Ensure fingerprints are stored for resuming
        storeFingerprintForResuming: true,
        removeFingerprintOnSuccess: true,

        onError: (error: Error) => {
          this.updateState({
            status: 'error',
            error: error,
          });
          this.events.onError?.(this.uploadFile.id, error);
          reject(error);
        },

        onProgress: (bytesUploaded: number, bytesTotal: number) => {
          this.updateProgress(bytesUploaded);
        },

        onSuccess: () => {
          const tusUrl = this.upload?.url || undefined;
          this.updateState({
            status: 'completed',
            tusUrl,
          });
          this.events.onComplete?.(this.uploadFile.id, tusUrl || '');
          // Clear previous upload URL on success
          this.previousUploadUrl = undefined;
          resolve();
        },
      };

      // Handle abort signal
      if (this.abortController.signal.aborted) {
        reject(new Error('Upload was aborted'));
        return;
      }

      this.abortController.signal.addEventListener('abort', () => {
        if (this.upload) {
          this.upload.abort();
        }
      });

      this.upload = new Upload(this.uploadFile.file, uploadOptions);

      // If resuming (we have a previous upload URL), try to find and resume the previous upload
      if (this.previousUploadUrl) {
        try {
          const previousUploads = await this.upload.findPreviousUploads();
          console.log('Found previous uploads:', previousUploads.length);

          const matchingUpload = previousUploads.find(
            upload => upload.uploadUrl === this.previousUploadUrl
          );

          if (matchingUpload) {
            console.log('Resuming from previous upload:', {
              url: matchingUpload.uploadUrl,
              size: matchingUpload.size,
              uploaded: matchingUpload.size ? this.state.progress.bytesUploaded : 0,
            });
            this.upload.resumeFromPreviousUpload(matchingUpload);
          } else {
            console.warn('Previous upload not found, starting new upload');
          }
        } catch (error) {
          console.warn('Could not find previous upload, starting new:', error);
          // Continue with new upload if resume fails
        }
      }

      this.upload.start();
    });
  }
}
