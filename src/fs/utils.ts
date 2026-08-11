import type { FsEntry, FsRecord } from './types';
import { CURRENT_RECORD_SCHEMA_VERSION } from './types';
import { generateFileId } from '../utils';

export function recordToEntry(rec: FsRecord): FsEntry {
  return {
    id: rec.id,
    kind: rec.kind,
    name: rec.name,
    relPath: rec.relPath,
    size: rec.size,
    type: rec.type,
    lastModified: rec.lastModified,
    handle: rec.handle,
    parentId: rec.parentId,
    hash: rec.hash,
  };
}

export function createRecordFromHandle(
  handle: FileSystemHandle,
  opts: {
    id?: string;
    parentId?: string;
    relPath?: string;
    file?: File;
  } = {}
): FsRecord {
  const now = Date.now();
  const file = opts.file;
  return {
    id: opts.id ?? generateFileId(),
    schemaVersion: CURRENT_RECORD_SCHEMA_VERSION,
    kind: handle.kind as 'file' | 'directory',
    name: handle.name,
    relPath: opts.relPath,
    size: file?.size,
    type: file?.type,
    lastModified: file?.lastModified,
    handle,
    parentId: opts.parentId,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeRecord(rec: FsRecord): FsRecord {
  if (rec.schemaVersion >= CURRENT_RECORD_SCHEMA_VERSION) {
    return rec;
  }
  return { ...rec, schemaVersion: CURRENT_RECORD_SCHEMA_VERSION };
}

export function joinPath(base: string, name: string): string {
  if (!base) return name;
  return `${base}/${name}`;
}

const RAW_EXTENSIONS = new Set([
  '.cr2',
  '.cr3',
  '.nef',
  '.arw',
  '.dng',
  '.raf',
  '.orf',
  '.rw2',
  '.pef',
  '.srw',
  '.raw',
]);

export function isRawFileName(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return false;
  return RAW_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

export function isImageMime(type: string): boolean {
  return type.startsWith('image/');
}

/** Single source of truth for the thumbnail cache key convention. */
export function thumbKeyFor(recordId: string): string {
  return `thumb-${recordId}`;
}
