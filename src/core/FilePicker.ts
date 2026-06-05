import { FilePickerOptions, UploadFile } from '../types';
import {
  createMockFileHandle,
  generateFileId,
  isFileSystemAccessSupported,
  parseAcceptString,
} from '../utils';

export class FilePicker {
  private options: FilePickerOptions;

  constructor(options: FilePickerOptions = {}) {
    this.options = {
      multiple: true,
      useFileSystemAccess: false,
      ...options,
    };
  }

  async pickFiles(): Promise<UploadFile[]> {
    if (this.options.useFileSystemAccess && isFileSystemAccessSupported()) {
      return this.pickWithFileSystemAccess();
    }
    if (this.options.useFileSystemAccess && !isFileSystemAccessSupported()) {
      return this.pickWithInputAndMockHandles();
    }
    return this.pickWithInput();
  }

  private async pickWithFileSystemAccess(): Promise<UploadFile[]> {
    try {
      const picker = (
        window as unknown as {
          showOpenFilePicker: (opts: {
            multiple?: boolean;
            types?: { description: string; accept: Record<string, string[]> }[];
          }) => Promise<FileSystemFileHandle[]>;
        }
      ).showOpenFilePicker;

      const fileHandles = await picker({
        multiple: this.options.multiple,
        // Build a valid MIME->extensions map; omit `types` entirely when the
        // accept string can't be represented (rather than passing a bad value).
        types: parseAcceptString(this.options.accept),
      });

      const uploadFiles: UploadFile[] = [];
      for (const fileHandle of fileHandles) {
        const file = await fileHandle.getFile();
        uploadFiles.push({
          id: generateFileId(),
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
    const files = await this.pickWithInputElement();
    return files.map(file => ({
      id: generateFileId(),
      file,
      fileHandle: createMockFileHandle(file),
      name: file.name,
      size: file.size,
      type: file.type,
    }));
  }

  private async pickWithInput(): Promise<UploadFile[]> {
    const files = await this.pickWithInputElement();
    return files.map(file => ({
      id: generateFileId(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    }));
  }

  private pickWithInputElement(): Promise<File[]> {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = this.options.multiple || false;
      if (this.options.accept) {
        input.accept = this.options.accept;
      }
      input.onchange = () => resolve(Array.from(input.files || []));
      input.click();
    });
  }
}
