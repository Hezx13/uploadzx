import { FilePicker } from '../../core/FilePicker';
import {
  createMockFileHandle,
  generateFileId,
  getFilesFromDragEvent,
  isFileSystemAccessSupported,
} from '../../utils';
import type { FsEntry } from '../types';
import { createRecordFromHandle, joinPath, recordToEntry } from '../utils';

export interface PickOptions {
  accept?: string;
  multiple?: boolean;
  useFileSystemAccess?: boolean;
}

export async function pickFiles(options: PickOptions = {}): Promise<FsEntry[]> {
  const picker = new FilePicker({
    accept: options.accept,
    multiple: options.multiple ?? true,
    useFileSystemAccess: options.useFileSystemAccess ?? isFileSystemAccessSupported(),
  });
  const uploadFiles = await picker.pickFiles();
  return uploadFiles.map(uf => {
    const rec = createRecordFromHandle(uf.fileHandle ?? createMockFileHandle(uf.file), {
      id: uf.id,
      file: uf.file,
    });
    return { ...recordToEntry(rec), file: uf.file, handle: rec.handle };
  });
}

export async function pickFromDragEvent(event: {
  dataTransfer: DataTransfer | null;
}): Promise<FsEntry[]> {
  const items = await getFilesFromDragEvent(event);
  return items.map(({ file, handle }) => {
    const h = handle ?? createMockFileHandle(file);
    const rec = createRecordFromHandle(h, { file });
    return { ...recordToEntry(rec), file, handle: h };
  });
}

export interface WalkDirectoryOptions {
  parentId?: string;
  basePath?: string;
  /** Filter by MIME or extension pattern, e.g. image/* */
  accept?: string;
  maxDepth?: number;
}

export async function walkDirectory(
  dirHandle: FileSystemDirectoryHandle,
  opts: WalkDirectoryOptions = {}
): Promise<FsEntry[]> {
  const entries: FsEntry[] = [];
  const maxDepth = opts.maxDepth ?? 10;
  const basePath = opts.basePath ?? '';
  const parentId = opts.parentId;

  const dirRec = createRecordFromHandle(dirHandle, {
    id: generateFileId(),
    parentId,
    relPath: basePath || undefined,
  });
  entries.push(recordToEntry(dirRec));

  await walkRecursive(dirHandle, dirRec.id, basePath, 0, maxDepth, opts.accept, entries);
  return entries;
}

async function* iterateDirectory(
  dirHandle: FileSystemDirectoryHandle
): AsyncGenerator<[string, FileSystemHandle]> {
  const handle = dirHandle as FileSystemDirectoryHandle & {
    entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    values?: () => AsyncIterableIterator<FileSystemHandle>;
  };

  if (handle.entries) {
    yield* handle.entries();
    return;
  }

  if (handle.values) {
    for await (const entry of handle.values()) {
      yield [entry.name, entry];
    }
  }
}

async function walkRecursive(
  dirHandle: FileSystemDirectoryHandle,
  parentId: string,
  basePath: string,
  depth: number,
  maxDepth: number,
  accept: string | undefined,
  out: FsEntry[]
): Promise<void> {
  if (depth >= maxDepth) return;

  for await (const [name, handle] of iterateDirectory(dirHandle)) {
    const relPath = joinPath(basePath, name);

    if (handle.kind === 'directory') {
      const dirRec = createRecordFromHandle(handle, { parentId, relPath });
      out.push(recordToEntry(dirRec));
      await walkRecursive(
        handle as FileSystemDirectoryHandle,
        dirRec.id,
        relPath,
        depth + 1,
        maxDepth,
        accept,
        out
      );
    } else {
      const fileHandle = handle as FileSystemFileHandle;
      let file: File | undefined;
      try {
        file = await fileHandle.getFile();
      } catch {
        continue;
      }
      if (accept && !matchesAccept(file, accept)) continue;

      const rec = createRecordFromHandle(fileHandle, { parentId, relPath, file });
      out.push({ ...recordToEntry(rec), file, handle: fileHandle });
    }
  }
}

function matchesAccept(file: File, accept: string): boolean {
  const tokens = accept.split(',').map(t => t.trim());
  for (const token of tokens) {
    if (token.endsWith('/*')) {
      const base = token.slice(0, -2);
      if (file.type.startsWith(base)) return true;
    } else if (token.startsWith('.')) {
      if (file.name.toLowerCase().endsWith(token.toLowerCase())) return true;
    } else if (file.type === token) {
      return true;
    }
  }
  return tokens.length === 0;
}
