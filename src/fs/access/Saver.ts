import { isFileSystemAccessSupported } from '../../utils';

export interface SaveOptions {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
  startIn?: 'desktop' | 'documents' | 'downloads' | 'pictures';
}

export class Saver {
  async saveAs(data: Blob | File, options: SaveOptions = {}): Promise<FileSystemFileHandle | null> {
    if (!isFileSystemAccessSupported()) {
      return this.downloadFallback(data, options.suggestedName);
    }

    try {
      const picker = (
        window as unknown as {
          showSaveFilePicker: (opts?: SaveOptions) => Promise<FileSystemFileHandle>;
        }
      ).showSaveFilePicker;

      const handle = await picker({
        suggestedName: options.suggestedName ?? (data instanceof File ? data.name : 'export'),
        types: options.types,
        startIn: options.startIn,
      });

      await this.writeToHandle(handle, data);
      return handle;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }

  async saveInPlace(handle: FileSystemFileHandle, data: Blob | File): Promise<void> {
    await this.writeToHandle(handle, data);
  }

  async writeFile(handle: FileSystemFileHandle, data: Blob | File): Promise<void> {
    await this.writeToHandle(handle, data);
  }

  private async writeToHandle(handle: FileSystemFileHandle, data: Blob | File): Promise<void> {
    const writable = await handle.createWritable();
    try {
      await writable.write(data);
      await writable.close();
    } catch (error) {
      try {
        await writable.abort();
      } catch {
        /* ignore */
      }
      throw error;
    }
  }

  private downloadFallback(data: Blob | File, suggestedName?: string): null {
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName ?? (data instanceof File ? data.name : 'export');
    a.click();
    URL.revokeObjectURL(url);
    return null;
  }
}
