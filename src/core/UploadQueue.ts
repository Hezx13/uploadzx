import {
  UploadFile,
  UploadOptions,
  UploadEvents,
  UploadState,
  StoredFileHandle,
  Uploader,
  PersistenceAdapter,
} from '../types';
import { createLogger, Logger, validateFile } from '../utils';
import { TusUploader, TusUploaderOptions } from './TusUploader';
import { FileHandleStore } from './FileHandleStore';

export type UploaderFactory = (
  file: UploadFile,
  options: UploadOptions,
  events: UploadEvents,
  tusOptions?: TusUploaderOptions
) => Uploader;

export interface QueueOptions extends UploadOptions {
  maxConcurrent?: number;
  autoStart?: boolean;
  /** Inject an alternative transport (S3 multipart, presigned PUT, ...). */
  uploaderFactory?: UploaderFactory;
  /** Inject an alternative persistence backend. */
  store?: PersistenceAdapter;
}

/** Minimum interval between IndexedDB progress writes, per file. */
const PROGRESS_PERSIST_INTERVAL_MS = 1000;

export class UploadQueue {
  private options: QueueOptions;
  private events: UploadEvents;
  private logger: Logger;
  private uploaderFactory: UploaderFactory;
  private uploaders: Map<string, Uploader> = new Map();
  private unfinishedUploads: Map<string, StoredFileHandle> = new Map();
  private queue: string[] = [];
  private activeUploads: Set<string> = new Set();
  private isInitialized: boolean = false;
  private lastPersist: Map<string, number> = new Map();
  public fileHandleStore: PersistenceAdapter;

  /** Resolves when the queue has loaded any prior unfinished uploads; rejects on init failure. */
  public readonly ready: Promise<void>;

  constructor(options: QueueOptions, events: UploadEvents = {}) {
    this.options = {
      maxConcurrent: 3,
      autoStart: false,
      ...options,
    };
    this.events = events;
    this.logger = createLogger(options.debug, options.logger);
    this.fileHandleStore = options.store ?? new FileHandleStore(this.logger);
    this.uploaderFactory =
      options.uploaderFactory ??
      ((file, opts, evts, tusOptions) =>
        new TusUploader(file, opts, evts, { ...tusOptions, logger: this.logger }));

    this.ready = this.initialize();
    // Mark as handled so a consumer that never awaits `ready` doesn't trigger
    // an unhandledrejection; explicit awaiters still observe the rejection.
    this.ready.catch(() => {});
  }

  private async initialize(): Promise<void> {
    try {
      await this.getUnfinishedUploadsFromStore();
      this.isInitialized = true;
      this.options.onInit?.();
    } catch (error) {
      this.logger.error('Failed to initialize UploadQueue:', error);
      // Still notify legacy onInit listeners, but surface the failure on `ready`.
      this.options.onInit?.();
      throw error;
    }
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  private buildEvents(): UploadEvents {
    return {
      onProgress: this.events.onProgress,
      onStateChange: state => this.handleStateChange(state),
      onComplete: (fileId, tusUrl) => {
        this.handleComplete(fileId, tusUrl);
        void this.fileHandleStore.removeFileHandle(fileId);
      },
      onError: (fileId, error) => this.handleError(fileId, error),
      onCancel: fileId => {
        void this.cancelUpload(fileId);
      },
    };
  }

  async addFiles(files: UploadFile[], tusOptions?: TusUploaderOptions): Promise<UploadFile[]> {
    const validation = this.options.validation;

    if (validation?.maxFiles && files.length > validation.maxFiles) {
      const error = new Error(
        `Too many files: ${files.length} exceeds maximum of ${validation.maxFiles}`
      );
      files.forEach(f => this.events.onError?.(f.id, error));
      return [];
    }

    const accepted: UploadFile[] = [];

    for (const file of files) {
      if (validation) {
        const reason = validateFile(file.file, {
          maxSize: validation.maxSize,
          allowedTypes: validation.allowedTypes,
        });
        if (reason) {
          this.logger.warn(`Rejected "${file.name}": ${reason}`);
          this.events.onError?.(file.id, new Error(reason));
          continue;
        }
      }

      const uploader = this.uploaderFactory(file, this.options, this.buildEvents(), tusOptions);
      this.uploaders.set(file.id, uploader);
      this.queue.push(file.id);

      if (file.fileHandle) {
        await this.fileHandleStore.storeFileHandle(file.fileHandle, file.id);
      }
      accepted.push(file);
    }

    if (this.options.autoStart) {
      this.processQueue();
    }
    return accepted;
  }

  async startQueue(): Promise<void> {
    this.processQueue();
  }

  async pauseAll(): Promise<void> {
    for (const uploader of this.uploaders.values()) {
      await uploader.pause();
      await this.persistProgress(uploader, true);
    }
  }

  async resumeAll(): Promise<void> {
    for (const [fileId, uploader] of this.uploaders) {
      if (uploader.getState().status === 'paused') {
        this.enqueue(fileId);
      }
    }
    this.processQueue();
  }

  async cancelAll(): Promise<void> {
    for (const uploader of this.uploaders.values()) {
      await uploader.cancel();
    }
    this.activeUploads.clear();
    this.queue.length = 0;
    this.lastPersist.clear();
    await this.fileHandleStore.clear();
  }

  async pauseUpload(fileId: string): Promise<void> {
    const uploader = this.uploaders.get(fileId);
    if (uploader) {
      await uploader.pause();
      this.activeUploads.delete(fileId);
      await this.persistProgress(uploader, true);
      this.processQueue();
    }
  }

  async resumeUpload(fileId: string): Promise<void> {
    const uploader = this.uploaders.get(fileId);
    if (uploader && uploader.getState().status === 'paused') {
      this.enqueue(fileId);
      this.processQueue();
    }
  }

  async cancelUpload(fileId: string): Promise<void> {
    const uploader = this.uploaders.get(fileId);
    if (uploader) {
      await uploader.cancel();
      this.activeUploads.delete(fileId);
      this.removeFromQueue(fileId);
      this.lastPersist.delete(fileId);
      this.processQueue();
      await this.fileHandleStore.removeFileHandle(fileId);
    }
  }

  clearCompletedUploads(): void {
    for (const [fileId, uploader] of this.uploaders) {
      const status = uploader.getState().status;
      if (status === 'completed' || status === 'cancelled') {
        this.uploaders.delete(fileId);
        this.lastPersist.delete(fileId);
      }
    }
  }

  getUploadState(fileId: string): UploadState | null {
    const uploader = this.uploaders.get(fileId);
    return uploader ? uploader.getState() : null;
  }

  getAllStates(): UploadState[] {
    return Array.from(this.uploaders.values()).map(uploader => uploader.getState());
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getActiveCount(): number {
    return this.activeUploads.size;
  }

  async getUnfinishedUploads(): Promise<StoredFileHandle[]> {
    return Array.from(this.unfinishedUploads.values());
  }

  async restoreUnfinishedUpload(
    fileHandleOrId: StoredFileHandle | string,
    tusOpts?: TusUploaderOptions
  ): Promise<void> {
    return this.resumeUnfinishedUpload(fileHandleOrId, tusOpts);
  }

  /** Adds a file id to the pending queue if it isn't already queued. */
  private enqueue(fileId: string): void {
    if (!this.queue.includes(fileId) && !this.activeUploads.has(fileId)) {
      this.queue.push(fileId);
    }
  }

  /** Persists upload progress to storage, throttled per file unless forced. */
  private async persistProgress(uploader: Uploader, force = false): Promise<void> {
    const fileId = uploader.getState().fileId;
    const now = Date.now();
    const last = this.lastPersist.get(fileId) ?? 0;
    if (!force && now - last < PROGRESS_PERSIST_INTERVAL_MS) {
      return;
    }
    this.lastPersist.set(fileId, now);
    await this.updateStoredFileHandleProgress(uploader);
  }

  private async updateStoredFileHandleProgress(uploader: Uploader): Promise<void> {
    const state = uploader.getState();
    const uploadUrl = uploader.getCurrentUploadUrl();

    if (uploadUrl && state.progress.bytesUploaded > 0) {
      const storedHandle = this.unfinishedUploads.get(state.fileId);
      if (storedHandle) {
        const updatedHandle: StoredFileHandle = {
          ...storedHandle,
          tusUploadUrl: uploadUrl,
          bytesUploaded: state.progress.bytesUploaded,
        };
        this.unfinishedUploads.set(state.fileId, updatedHandle);
      }
      await this.fileHandleStore.updateFileHandleProgress(
        state.fileId,
        uploadUrl,
        state.progress.bytesUploaded
      );
    }
  }

  private processQueue(): void {
    const maxConcurrent = this.options.maxConcurrent || 3;

    while (this.queue.length > 0 && this.activeUploads.size < maxConcurrent) {
      const fileId = this.queue.shift();
      if (!fileId) continue;

      const uploader = this.uploaders.get(fileId);
      if (!uploader) continue;

      const status = uploader.getState().status;
      if (status === 'pending') {
        this.activeUploads.add(fileId);
        uploader.start().catch(() => {
          /* handled in onError */
        });
      } else if (status === 'paused') {
        this.activeUploads.add(fileId);
        uploader.resume().catch(() => {
          /* handled in onError */
        });
      }
    }
  }

  private handleStateChange(state: UploadState): void {
    if (state.status === 'uploading' || state.status === 'paused') {
      const uploader = this.uploaders.get(state.fileId);
      if (uploader) {
        // Throttled while uploading; forced on pause to capture the final offset.
        void this.persistProgress(uploader, state.status === 'paused');
      }
    }

    this.events.onStateChange?.(state);
  }

  private handleComplete(fileId: string, tusUrl: string): void {
    this.activeUploads.delete(fileId);
    this.unfinishedUploads.delete(fileId);
    this.lastPersist.delete(fileId);
    this.events.onComplete?.(fileId, tusUrl);
    this.processQueue();
  }

  private handleError(fileId: string, error: Error): void {
    this.activeUploads.delete(fileId);
    const uploader = this.uploaders.get(fileId);
    if (uploader) {
      // Force-persist on error so the upload can be resumed later.
      void this.persistProgress(uploader, true);
    }
    this.events.onError?.(fileId, error);
    this.processQueue();
  }

  private removeFromQueue(fileId: string): void {
    const index = this.queue.indexOf(fileId);
    if (index > -1) {
      this.queue.splice(index, 1);
    }
  }

  private async getUnfinishedUploadsFromStore(): Promise<void> {
    const fileHandles = await this.fileHandleStore.getAllFileHandles();

    this.unfinishedUploads = new Map(
      fileHandles
        .filter(fileHandle => !this.activeUploads.has(fileHandle.id))
        .map(fileHandle => [fileHandle.id, fileHandle])
    );
  }

  private async resumeUnfinishedUpload(
    fileHandleOrId: StoredFileHandle | string,
    tusOpts?: TusUploaderOptions
  ): Promise<void> {
    let id: string;
    let fileHandle: StoredFileHandle | undefined;

    if (typeof fileHandleOrId === 'string') {
      id = fileHandleOrId;
      fileHandle = this.unfinishedUploads.get(id);
    } else {
      id = fileHandleOrId.id;
      fileHandle = fileHandleOrId;
    }

    if (!fileHandle) {
      this.logger.warn('restoreUnfinishedUpload: handle not found for', id);
      return;
    }

    const file = await this.fileHandleStore.getFileFromHandleByID(id);
    if (!file) {
      // Permission may simply be unavailable outside a user gesture — keep the
      // record so a later user-initiated retry can succeed.
      this.logger.warn('restoreUnfinishedUpload: file not currently available for', id);
      return;
    }

    if (file.lastModified !== fileHandle.lastModified) {
      this.logger.warn(
        `File modified since last access: ${fileHandle.name}. Removing from storage.`
      );
      await this.fileHandleStore.removeFileHandle(fileHandle.id);
      this.unfinishedUploads.delete(fileHandle.id);
      return;
    }

    const tusOptions: TusUploaderOptions = {
      previousUploadUrl: fileHandle.tusUploadUrl,
      previousBytesUploaded: fileHandle.bytesUploaded || 0,
      trackSpeed: tusOpts?.trackSpeed || false,
      logger: this.logger,
    };

    const uploader = this.uploaderFactory(
      {
        id: fileHandle.id,
        file,
        fileHandle: fileHandle.handle,
        name: fileHandle.name,
        size: fileHandle.size,
        type: fileHandle.type,
      },
      this.options,
      this.buildEvents(),
      tusOptions
    );

    this.uploaders.set(fileHandle.id, uploader);

    if (this.options.autoStart) {
      this.enqueue(fileHandle.id);
      this.processQueue();
    }
  }
}
