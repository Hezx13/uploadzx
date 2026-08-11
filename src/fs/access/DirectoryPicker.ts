import {
  createMockFileHandle,
  generateFileId,
  isFileSystemAccessSupported,
  markHandleSynthetic,
} from '../../utils';
import type { FsEntry } from '../types';
import { walkDirectory } from './pick';
import { createRecordFromHandle, recordToEntry } from '../utils';

export interface DirectoryPickOptions {
  mode?: 'read' | 'readwrite';
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  accept?: string;
  maxDepth?: number;
}

export class DirectoryPicker {
  async pickDirectory(options: DirectoryPickOptions = {}): Promise<{
    dirHandle?: FileSystemDirectoryHandle;
    entries: FsEntry[];
    usedFallback: boolean;
  }> {
    if (isFileSystemAccessSupported()) {
      try {
        const picker = (
          window as unknown as {
            showDirectoryPicker: (opts?: {
              mode?: string;
              startIn?: string;
            }) => Promise<FileSystemDirectoryHandle>;
          }
        ).showDirectoryPicker;

        const dirHandle = await picker({
          mode: options.mode ?? 'read',
          startIn: options.startIn ?? 'pictures',
        });

        const entries = await walkDirectory(dirHandle, {
          accept: options.accept,
          maxDepth: options.maxDepth,
        });

        return { dirHandle, entries, usedFallback: false };
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return { entries: [], usedFallback: false };
        }
        throw error;
      }
    }

    const entries = await this.pickWithWebkitDirectory(options.accept);
    return { entries, usedFallback: true };
  }

  private pickWithWebkitDirectory(accept?: string): Promise<FsEntry[]> {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
      if (accept) {
        input.accept = accept;
      }
      input.onchange = () => {
        const files = Array.from(input.files || []);
        const dirId = generateFileId();
        const rootRec = createRecordFromHandle(
          createMockDirHandle('Selected Folder'),
          { id: dirId }
        );
        const entries: FsEntry[] = [recordToEntry(rootRec)];

        for (const file of files) {
          const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
          const rec = createRecordFromHandle(createMockFileHandle(file), {
            parentId: dirId,
            relPath,
            file,
          });
          entries.push({ ...recordToEntry(rec), file, handle: rec.handle });
        }
        resolve(entries);
      };
      input.click();
    });
  }
}

function createMockDirHandle(name: string): FileSystemDirectoryHandle {
  return markHandleSynthetic({
    kind: 'directory',
    name,
    entries: async function* () {},
    getDirectoryHandle: async () => {
      throw new Error('Not supported in fallback mode');
    },
    getFileHandle: async () => {
      throw new Error('Not supported in fallback mode');
    },
    removeEntry: async () => {
      throw new Error('Not supported in fallback mode');
    },
    resolve: async () => null,
    isSameEntry: async () => false,
  }) as unknown as FileSystemDirectoryHandle;
}
