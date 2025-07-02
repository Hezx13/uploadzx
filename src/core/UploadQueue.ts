import { UploadFile, UploadOptions, UploadEvents, UploadState, StoredFileHandle } from '../types';
import { TusUploader } from './TusUploader';
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
    this.getUnfinishedUploadsFromStore();
  }

  async addFiles(files: UploadFile[]): Promise<void> {
    for (const file of files) {
      const uploader = new TusUploader(file, this.options, {
        onProgress: this.events.onProgress,
        onStateChange: (state) => {
          this.handleStateChange(state);
        },
        onComplete: (fileId, tusUrl) => {
          this.handleComplete(fileId, tusUrl);
          this.fileHandleStore.removeFileHandle(fileId);
        },
        onError: (fileId, error) => {
          this.handleError(fileId, error);
        },
        onCancel: (fileId) => {
          this.cancelUpload(fileId);
        }
      });

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
    }
  }

  async resumeUpload(fileId: string): Promise<void> {
    const uploader = this.uploaders.get(fileId);
    if (uploader) {
      await uploader.resume();
    }
  }

  async cancelUpload(fileId: string): Promise<void> {
    const uploader = this.uploaders.get(fileId);
    if (uploader) {
      await uploader.cancel();
      this.activeUploads.delete(fileId);
      this.removeFromQueue(fileId);
      this.processQueue();
      this.fileHandleStore.removeFileHandle(fileId);
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

  async restoreUnfinishedUpload(fileHandleOrId: StoredFileHandle | string): Promise<void> {
    return await this.resumeUnfinishedUpload(fileHandleOrId);
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
          // Error handling is done in the uploader's onError callback
        });
      }
    }
  }

  private handleStateChange(state: UploadState): void {
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
    console.log('Found unfinished uploads:', fileHandles.length);
    
    this.unfinishedUploads = new Map(fileHandles.map(fileHandle => [fileHandle.id, fileHandle]));
  }

  private async resumeUnfinishedUpload(fileHandleOrId: StoredFileHandle | string): Promise<void> {
    let id;
    let fileHandle;
    console.log('resumeUnfinishedUpload', fileHandleOrId);
    if (typeof fileHandleOrId === 'string') {
      id = fileHandleOrId;
      fileHandle = this.unfinishedUploads.get(id);
      console.log('fileHandle', fileHandle);
    }
    else {
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
    await this.addFiles([{
      id: fileHandle.id,
      file: file,
      fileHandle: fileHandle.handle,
      name: fileHandle.name,
      size: fileHandle.size,
      type: fileHandle.type,
    }]);
  }
} 