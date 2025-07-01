import { FilePickerOptions, UploadFile } from '../types';

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
    if (this.options.useFileSystemAccess && 'showOpenFilePicker' in window) {
      return this.pickWithFileSystemAccess();
    }
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