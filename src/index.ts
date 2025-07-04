// Export types
export * from './types';

// Export core modules
export { FilePicker } from './core/FilePicker';
export { TusUploader } from './core/TusUploader';
export { UploadQueue, type QueueOptions } from './core/UploadQueue';
export { FileHandleStore } from './core/FileHandleStore';

// Export utilities
export * from './utils';

// Main library class
import { FilePicker } from './core/FilePicker';
import { UploadQueue, QueueOptions } from './core/UploadQueue';
import { FilePickerOptions, StoredFileHandle, UploadEvents } from './types';

export interface UploadzxOptions extends QueueOptions {
  filePickerOptions?: FilePickerOptions;
}

export class Uploadzx {
  private filePicker: FilePicker;
  private uploadQueue: UploadQueue;

  constructor(options: UploadzxOptions, events: UploadEvents = {}) {
    this.filePicker = new FilePicker(options.filePickerOptions);
    this.uploadQueue = new UploadQueue(options, events);
  }

  getIsInitialized(): boolean {
    return this.uploadQueue.getIsInitialized();
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

  async addFiles(files: any[]) {
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
    console.log('cancelAll');
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
