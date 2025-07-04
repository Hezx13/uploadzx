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
}

export interface UploadState {
  fileId: string;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error' | 'cancelled';
  progress: UploadProgress;
  error?: Error;
  tusUrl?: string;
  file: File;
}

export interface UploadOptions {
  endpoint: string;
  chunkSize?: number;
  retryDelays?: number[];
  metadata?: Record<string, string>;
  headers?: Record<string, string>;
  onInit?: () => void;
}

export interface UploadEvents {
  onProgress?: (progress: UploadProgress) => void;
  onStateChange?: (state: UploadState) => void;
  onComplete?: (fileId: string, tusUrl: string) => void;
  onError?: (fileId: string, error: Error) => void;
  onCancel?: (fileId: string) => void;
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
  tusUploadUrl?: string;
  bytesUploaded?: number;
} 