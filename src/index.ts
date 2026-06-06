// Export types
export * from './types';
export * from './transport/types';

// Export core modules
export { FilePicker } from './core/FilePicker';
export { UploadQueue, type UploadQueueConstructorOptions, type UploaderFactory } from './core/UploadQueue';
export { FileHandleStore } from './core/FileHandleStore';

// Export transport drivers and utilities
export { UploadController } from './transport/UploadController';
export { ProgressTracker } from './transport/ProgressTracker';
export { TusDriver, tus, type TusDriverOptions, type TusResumeData } from './transport/TusDriver';
export { HttpPutDriver, httpPut, type HttpPutDriverOptions } from './transport/HttpPutDriver';

export * from './utils';

// Main library class
import { FilePicker } from './core/FilePicker';
import { UploadQueue } from './core/UploadQueue';
import {
  FilePickerOptions,
  StoredFileHandle,
  UploadEvents,
  UploadEventMap,
  UploadFile,
  QueueOptions,
} from './types';

export interface UploadzxOptions extends QueueOptions {
  filePickerOptions?: FilePickerOptions;
}

export class Uploadzx {
  private filePicker: FilePicker;
  private uploadQueue: UploadQueue;

  /** Resolves once prior unfinished uploads are loaded; rejects on init failure. */
  public readonly ready: Promise<void>;

  constructor(options: UploadzxOptions, events: UploadEvents = {}) {
    this.filePicker = new FilePicker(options.filePickerOptions);
    this.uploadQueue = new UploadQueue(options, events);
    this.ready = this.uploadQueue.ready;
  }

  getIsInitialized(): boolean {
    return this.uploadQueue.getIsInitialized();
  }

  /** Subscribe to an upload event. Returns an unsubscribe function. */
  on<K extends keyof UploadEventMap>(event: K, listener: UploadEventMap[K]): () => void {
    return this.uploadQueue.on(event, listener);
  }

  /** Subscribe to a single occurrence of an upload event. */
  once<K extends keyof UploadEventMap>(event: K, listener: UploadEventMap[K]): () => void {
    return this.uploadQueue.once(event, listener);
  }

  /** Remove a previously registered listener. */
  off<K extends keyof UploadEventMap>(event: K, listener: UploadEventMap[K]): void {
    this.uploadQueue.off(event, listener);
  }

  async pickAndUploadFiles(): Promise<void> {
    const files = await this.filePicker.pickFiles();
    if (files.length > 0) {
      await this.uploadQueue.addFiles(files);
    }
  }

  async pickFiles() {
    return this.filePicker.pickFiles();
  }

  async addFiles(files: UploadFile[]) {
    return this.uploadQueue.addFiles(files);
  }

  async startUploads() {
    return this.uploadQueue.startQueue();
  }

  async pauseAll() {
    return this.uploadQueue.pauseAll();
  }

  async resumeAll() {
    return this.uploadQueue.resumeAll();
  }

  async cancelAll() {
    return this.uploadQueue.cancelAll();
  }

  async pauseUpload(fileId: string) {
    return this.uploadQueue.pauseUpload(fileId);
  }

  async resumeUpload(fileId: string) {
    return this.uploadQueue.resumeUpload(fileId);
  }

  async cancelUpload(fileId: string) {
    return this.uploadQueue.cancelUpload(fileId);
  }

  async restoreUnfinishedUpload(fileHandleOrId: StoredFileHandle | string) {
    return this.uploadQueue.restoreUnfinishedUpload(fileHandleOrId);
  }

  async clearCompletedUploads() {
    return this.uploadQueue.clearCompletedUploads();
  }

  getUploadState(fileId: string) {
    return this.uploadQueue.getUploadState(fileId);
  }

  getAllStates() {
    return this.uploadQueue.getAllStates();
  }

  getQueueStats() {
    return {
      queueLength: this.uploadQueue.getQueueLength(),
      activeCount: this.uploadQueue.getActiveCount(),
    };
  }

  async getUnfinishedUploads() {
    return this.uploadQueue.getUnfinishedUploads();
  }
}

// Default export
export default Uploadzx;
