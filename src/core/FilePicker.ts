import { FilePickerOptions, UploadFile } from '../types';
import { isFileSystemAccessSupported } from '../utils';

export class FilePicker {
  private options: FilePickerOptions;

  constructor(options: FilePickerOptions = {}) {
    this.options = {
      multiple: false,
      useFileSystemAccess: false,
      ...options,
    };
  }

  async pickFiles(): Promise<UploadFile[]> {
    if (this.options.useFileSystemAccess && isFileSystemAccessSupported()) {
      console.log('Picking files with file system access');
      return this.pickWithFileSystemAccess();
    } else if (this.options.useFileSystemAccess && !isFileSystemAccessSupported()) {
      console.log('Picking files with input (Safari fallback for File System Access)');
      return this.pickWithInputAndMockHandles();
    }
    console.log('Picking files with input');
    return this.pickWithInput();
  }

  private async pickWithFileSystemAccess(): Promise<UploadFile[]> {
    try {
      const fileHandles = await (window as any).showOpenFilePicker({
        multiple: this.options.multiple,
        types: this.options.accept ? [
          {
            description: 'Files',
            accept: { '*/*': [this.options.accept] },
          },
        ] : undefined,
      });

      const uploadFiles: UploadFile[] = [];
      
      for (const fileHandle of fileHandles) {
        const file = await fileHandle.getFile();
        uploadFiles.push({
          id: crypto.randomUUID(),
          file,
          fileHandle,
          name: file.name,
          size: file.size,
          type: file.type,
        });
      }

      return uploadFiles;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return [];
      }
      throw error;
    }
  }

  private async pickWithInputAndMockHandles(): Promise<UploadFile[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = this.options.multiple || false;
      
      if (this.options.accept) {
        input.accept = this.options.accept;
      }

      input.onchange = () => {
        const files = Array.from(input.files || []);
        const uploadFiles: UploadFile[] = files.map((file) => {
          // Create a mock FileSystemFileHandle for Safari
          const mockHandle = this.createMockFileHandle(file);
          
          return {
            id: crypto.randomUUID(),
            file,
            fileHandle: mockHandle,
            name: file.name,
            size: file.size,
            type: file.type,
          };
        });
        resolve(uploadFiles);
      };

      input.click();
    });
  }

  private createMockFileHandle(file: File): FileSystemFileHandle {
    // Create a mock FileSystemFileHandle that works with Safari
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

  private async pickWithInput(): Promise<UploadFile[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = this.options.multiple || false;
      
      if (this.options.accept) {
        input.accept = this.options.accept;
      }

      input.onchange = () => {
        const files = Array.from(input.files || []);
        const uploadFiles: UploadFile[] = files.map((file) => ({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
        }));
        resolve(uploadFiles);
      };

      input.click();
    });
  }
} 