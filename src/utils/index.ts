// Type augmentation for File System Access API
declare global {
  interface DataTransferItem {
    getAsFileSystemHandle?(): Promise<FileSystemHandle | null>;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatUploadSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s';

  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));

  // Ensure we don't go beyond our sizes array
  const sizeIndex = Math.min(i, sizes.length - 1);
  const value = bytesPerSecond / Math.pow(k, sizeIndex);

  // Use appropriate decimal places based on size
  const decimals = sizeIndex === 0 ? 0 : sizeIndex === 1 ? 1 : 2;

  return parseFloat(value.toFixed(decimals)) + ' ' + sizes[sizeIndex];
}

export function generateFileId(): string {
  return crypto.randomUUID();
}

export function validateFile(
  file: File,
  options: { maxSize?: number; allowedTypes?: string[] } = {}
): string | null {
  if (options.maxSize && file.size > options.maxSize) {
    return `File size exceeds maximum of ${formatFileSize(options.maxSize)}`;
  }

  if (options.allowedTypes && options.allowedTypes.length > 0) {
    const isAllowed = options.allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        const baseType = type.slice(0, -2);
        return file.type.startsWith(baseType);
      }
      return file.type === type;
    });

    if (!isAllowed) {
      return `File type ${file.type} is not allowed`;
    }
  }

  return null;
}

export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'showOpenFilePicker' in window &&
    'showSaveFilePicker' in window &&
    'showDirectoryPicker' in window
  );
}

export function isSafari(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent;
  const vendor = window.navigator.vendor;

  // Check for Safari (but not Chrome, which also has Safari in user agent)
  return (
    /Safari/.test(userAgent) &&
    /Apple Computer/.test(vendor) &&
    !/Chrome/.test(userAgent) &&
    !/Chromium/.test(userAgent)
  );
}

export function getBrowserInfo(): {
  name: string;
  version: string;
  isFileSystemAccessSupported: boolean;
} {
  if (typeof window === 'undefined') {
    return { name: 'Unknown', version: 'Unknown', isFileSystemAccessSupported: false };
  }

  const userAgent = window.navigator.userAgent;
  let browserName = 'Unknown';
  let version = 'Unknown';

  if (isSafari()) {
    browserName = 'Safari';
    const match = userAgent.match(/Version\/([0-9._]+)/);
    version = match ? match[1] : 'Unknown';
  } else if (/Chrome/.test(userAgent)) {
    browserName = 'Chrome';
    const match = userAgent.match(/Chrome\/([0-9.]+)/);
    version = match ? match[1] : 'Unknown';
  } else if (/Firefox/.test(userAgent)) {
    browserName = 'Firefox';
    const match = userAgent.match(/Firefox\/([0-9.]+)/);
    version = match ? match[1] : 'Unknown';
  } else if (/Edge/.test(userAgent)) {
    browserName = 'Edge';
    const match = userAgent.match(/Edge\/([0-9.]+)/);
    version = match ? match[1] : 'Unknown';
  }

  return {
    name: browserName,
    version,
    isFileSystemAccessSupported: isFileSystemAccessSupported(),
  };
}

/**
 * Creates a mock FileSystemFileHandle for Safari fallback
 */
function createMockFileHandle(file: File): FileSystemFileHandle {
  const mockHandle = {
    kind: 'file' as const,
    name: file.name,
    getFile: async () => file,
    queryPermission: async () => 'granted' as PermissionState,
    requestPermission: async () => 'granted' as PermissionState,
    createWritable: async () => {
      throw new Error('Write operations not supported in Safari fallback mode');
    },
    isSameEntry: async () => false,
  } as FileSystemFileHandle;

  return mockHandle;
}

/**
 * Extracts file handles from drag and drop DataTransferItems
 * Falls back to creating mock handles for Safari
 */
export async function getFileHandlesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<{ file: File; handle?: FileSystemFileHandle }[]> {
  const items = Array.from(dataTransfer.items).filter(item => item.kind === 'file');
  const results: { file: File; handle?: FileSystemFileHandle }[] = [];

  for (const item of items) {
    try {
      // Try to get file handle (supported in Chrome/Edge)
      if (item.getAsFileSystemHandle && isFileSystemAccessSupported()) {
        const handle = await item.getAsFileSystemHandle();
        if (handle && handle.kind === 'file') {
          const file = await (handle as FileSystemFileHandle).getFile();
          results.push({ file, handle: handle as FileSystemFileHandle });
          continue;
        }
      }
    } catch (error) {
      console.warn('Failed to get file handle from drag item:', error);
    }

    // Fallback to regular file (Safari, Firefox, or when getAsFileSystemHandle fails)
    const file = item.getAsFile();
    if (file) {
      const mockHandle = createMockFileHandle(file);
      results.push({ file, handle: mockHandle });
    }
  }

  return results;
}

/**
 * Extracts files and their handles from a drag event
 * Automatically handles Safari fallback
 * Works with both React DragEvent and native DragEvent
 */
export async function getFilesFromDragEvent(event: {
  dataTransfer: DataTransfer | null;
}): Promise<{ file: File; handle?: FileSystemFileHandle }[]> {
  if (!event.dataTransfer) {
    return [];
  }
  return getFileHandlesFromDataTransfer(event.dataTransfer);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}
