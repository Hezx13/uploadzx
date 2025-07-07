import { UploadFile, UploadOptions, UploadEvents, UploadState, StoredFileHandle } from '../types';
import { TusUploader, TusUploaderOptions } from './TusUploader';
import { FileHandleStore } from './FileHandleStore';

export interface QueueOptions extends UploadOptions {
  maxConcurrent?: number;
  autoStart?: boolean;
}

export class UploadQueue {
  private options: QueueOptions;
  private events: UploadEvents;
  private uploaders: Map<string, TusUploader> = new Map();
  private unfinishedUploads: Map<string, StoredFileHandle> = new Map();
  private queue: string[] = [];
  private activeUploads: Set<string> = new Set();
  private isInitialized: boolean = false;
  public fileHandleStore: FileHandleStore;

  constructor(options: QueueOptions, events: UploadEvents = {}) {
    console.log('UploadQueue constructor', options, events);
    this.options = {
      maxConcurrent: 3,
      autoStart: false,
      ...options,
    };
    this.events = events;
    this.fileHandleStore = new FileHandleStore();

    // Initialize asynchronously
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      console.log('initialize');
      await this.getUnfinishedUploadsFromStore();
      console.log('initialize 2');
      this.isInitialized = true;
      console.log('initialize 3');
      this.options.onInit?.();
      console.log('initialize 4');
    } catch (error) {
      console.error('Failed to initialize UploadQueue:', error);
      console.log('initialize 5');
      this.options.onInit?.();
    }
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  async addFiles(files: UploadFile[], tusOptions?: TusUploaderOptions): Promise<void> {
    for (const file of files) {
      const uploader = new TusUploader(
        file,
        this.options,
        {
          onProgress: this.events.onProgress,
          onStateChange: state => {
            this.handleStateChange(state);
          },
          onComplete: (fileId, tusUrl) => {
            this.handleComplete(fileId, tusUrl);
            this.fileHandleStore.removeFileHandle(fileId);
          },
          onError: (fileId, error) => {
            this.handleError(fileId, error);
          },
          onCancel: fileId => {
            this.cancelUpload(fileId);
          },
        },
        tusOptions
      );

      this.uploaders.set(file.id, uploader);
      this.queue.push(file.id);

      if (file.fileHandle) {
        await this.fileHandleStore.storeFileHandle(file.fileHandle, file.id);
      }
    }

    if (this.options.autoStart) {
      this.processQueue();
    }
  }

  async startQueue(): Promise<void> {
    this.processQueue();
  }

  async pauseAll(): Promise<void> {
    for (const uploader of this.uploaders.values()) {
      await uploader.pause();
      // Update stored file handle with current upload progress
      await this.updateStoredFileHandleProgress(uploader);
    }
  }

  async resumeAll(): Promise<void> {
    for (const uploader of this.uploaders.values()) {
      const state = uploader.getState();
      if (state.status === 'paused') {
        await uploader.resume();
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
    this.fileHandleStore.clear();
  }

  async pauseUpload(fileId: string): Promise<void> {
    const uploader = this.uploaders.get(fileId);
    if (uploader) {
      await uploader.pause();
      // Update stored file handle with current upload progress
      await this.updateStoredFileHandleProgress(uploader);
    }
  }

  async resumeUpload(fileId: string): Promise<void> {
    const uploader = this.uploaders.get(fileId);
    if (uploader) {
      await uploader.resume();
    }
  }

  async cancelUpload(fileId: string): Promise<void> {
    console.log('cancelUpload', fileId);
    const uploader = this.uploaders.get(fileId);
    console.log('uploader', uploader);
    if (uploader) {
      await uploader.cancel();
      this.activeUploads.delete(fileId);
      this.removeFromQueue(fileId);
      this.processQueue();
      this.fileHandleStore.removeFileHandle(fileId);
    }
  }

  clearCompletedUploads(): void {
    for (const fileId of this.uploaders.keys()) {
      if (this.activeUploads.has(fileId)) {
        this.uploaders.delete(fileId);
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
    return await this.resumeUnfinishedUpload(fileHandleOrId, tusOpts);
  }

  private async updateStoredFileHandleProgress(uploader: TusUploader): Promise<void> {
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
        await this.fileHandleStore.updateFileHandleProgress(
          state.fileId,
          uploadUrl,
          state.progress.bytesUploaded
        );
      }
    }
  }

  private async processQueue(): Promise<void> {
    const maxConcurrent = this.options.maxConcurrent || 3;

    while (this.queue.length > 0 && this.activeUploads.size < maxConcurrent) {
      const fileId = this.queue.shift();
      if (!fileId) continue;

      const uploader = this.uploaders.get(fileId);
      if (!uploader) continue;

      const state = uploader.getState();
      if (state.status === 'pending' || state.status === 'paused') {
        this.activeUploads.add(fileId);
        uploader.start().catch(() => {
          // done in onError
        });
      }
    }
  }

  private handleStateChange(state: UploadState): void {
    if (state.status === 'uploading' || state.status === 'paused') {
      const uploader = this.uploaders.get(state.fileId);
      if (uploader) {
        this.updateStoredFileHandleProgress(uploader);
      }
    }

    this.events.onStateChange?.(state);
  }

  private handleComplete(fileId: string, tusUrl: string): void {
    this.activeUploads.delete(fileId);
    this.unfinishedUploads.delete(fileId);
    this.events.onComplete?.(fileId, tusUrl);
    this.processQueue();
  }

  private handleError(fileId: string, error: Error): void {
    this.activeUploads.delete(fileId);
    // Update stored progress on error for potential resumption
    const uploader = this.uploaders.get(fileId);
    if (uploader) {
      this.updateStoredFileHandleProgress(uploader);
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
    return;
  }

  private async resumeUnfinishedUpload(
    fileHandleOrId: StoredFileHandle | string,
    tusOpts?: TusUploaderOptions
  ): Promise<void> {
    let id;
    let fileHandle;
    if (typeof fileHandleOrId === 'string') {
      id = fileHandleOrId;
      fileHandle = this.unfinishedUploads.get(id);
      console.log('fileHandle', fileHandle);
    } else {
      id = fileHandleOrId.id;
      fileHandle = fileHandleOrId;
    }

    if (!fileHandle) {
      console.log('fileHandle not found');
      return;
    }

    const file = await this.fileHandleStore.getFileFromHandleByID(id);
    console.log('file restored', file);
    if (!file) {
      console.log('file not found');
      return;
    }

    if (file.lastModified !== fileHandle.lastModified) {
      console.warn(`File modified since last access: ${fileHandle.name}. Removing from storage.`);
      await this.fileHandleStore.removeFileHandle(fileHandle.id);
      return;
    }

    console.log('file found', file);

    // Create TusUploader with previous upload information for resumption
    const tusOptions: TusUploaderOptions = {
      previousUploadUrl: fileHandle.tusUploadUrl,
      previousBytesUploaded: fileHandle.bytesUploaded || 0,
      trackSpeed: tusOpts?.trackSpeed || false,
    };

    const uploader = new TusUploader(
      {
        id: fileHandle.id,
        file: file,
        fileHandle: fileHandle.handle,
        name: fileHandle.name,
        size: fileHandle.size,
        type: fileHandle.type,
      },
      this.options,
      {
        onProgress: this.events.onProgress,
        onStateChange: state => {
          this.handleStateChange(state);
        },
        onComplete: (fileId, tusUrl) => {
          this.handleComplete(fileId, tusUrl);
          this.fileHandleStore.removeFileHandle(fileId);
        },
        onError: (fileId, error) => {
          this.handleError(fileId, error);
        },
        onCancel: fileId => {
          this.cancelUpload(fileId);
        },
      },
      tusOptions
    );

    this.uploaders.set(fileHandle.id, uploader);

    // If auto-start is enabled, add to queue and start processing
    if (this.options.autoStart) {
      this.queue.push(fileHandle.id);
      this.processQueue();
    }
  }
}
