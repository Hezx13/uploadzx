import { TypedEmitter } from '../utils/emitter';
import { createLogger, type Logger } from '../utils';
import type {
  FsEntry,
  FsEventMap,
  FsManagerOptions,
  FsPermissionMode,
  FsRecord,
  ImageMetadata,
} from './types';
import { FsStore } from './store/FsStore';
import { PermissionManager } from './permissions/PermissionManager';
import { DirectoryPicker } from './access/DirectoryPicker';
import { Saver } from './access/Saver';
import { pickFiles, pickFromDragEvent } from './access/pick';
import { FileWatcher } from './watch/FileWatcher';
import { createMetadataReader, type MetadataReader } from './image/metadata';
import { createThumbnailer, ThumbnailCache } from './image/thumbnails';
import { createRecordFromHandle, recordToEntry } from './utils';
import type { RawDecoder } from './raw/index';

export class FileSystemManager extends TypedEmitter<FsEventMap> {
  readonly store: FsStore;
  readonly permissions: PermissionManager;
  readonly directoryPicker: DirectoryPicker;
  readonly saver: Saver;

  private watcher: FileWatcher;
  private metadataReader: MetadataReader;
  private thumbnailCache: ThumbnailCache;
  private rawDecoder?: RawDecoder;
  private options: FsManagerOptions;
  private logger: Logger;
  readonly ready: Promise<void>;

  constructor(options: FsManagerOptions = {}) {
    super();
    this.options = options;
    this.logger = createLogger(options.debug ?? false);
    this.store = new FsStore(options);
    this.permissions = new PermissionManager();
    this.directoryPicker = new DirectoryPicker();
    this.saver = new Saver();
    this.watcher = new FileWatcher(this.store, {
      pollIntervalMs: options.watchPollIntervalMs,
      verifyHash: options.watchVerifyHash,
    });
    this.metadataReader = createMetadataReader();
    const thumbnailer = createThumbnailer();
    this.thumbnailCache = new ThumbnailCache(this.store, thumbnailer);

    this.permissions.on('permissionchange', pending => {
      this.emit('permissionchange', pending);
    });

    this.watcher.on('add', entry => this.emit('add', entry));
    this.watcher.on('change', entry => this.emit('change', entry));
    this.watcher.on('remove', id => this.emit('remove', id));
    this.watcher.on('error', error => this.emit('error', error));

    this.ready = this.store.init();
  }

  setRawDecoder(decoder: RawDecoder): void {
    this.rawDecoder = decoder;
  }

  async pickFiles(withinGesture = true): Promise<FsEntry[]> {
    const entries = await pickFiles({
      accept: this.options.filePicker?.accept,
      multiple: this.options.filePicker?.multiple,
      useFileSystemAccess: this.options.filePicker?.useFileSystemAccess,
    });
    return this.persistEntries(entries, withinGesture);
  }

  async pickFromDrag(
    event: { dataTransfer: DataTransfer | null },
    withinGesture = true
  ): Promise<FsEntry[]> {
    const entries = await pickFromDragEvent(event);
    return this.persistEntries(entries, withinGesture);
  }

  async pickDirectory(withinGesture = true): Promise<{
    dirHandle?: FileSystemDirectoryHandle;
    entries: FsEntry[];
  }> {
    const { dirHandle, entries } = await this.directoryPicker.pickDirectory({
      accept: this.options.filePicker?.accept,
      startIn: 'pictures',
    });
    const persisted = await this.persistEntries(entries, withinGesture);

    if (dirHandle && withinGesture) {
      await this.permissions.ensure([dirHandle], 'read', { withinGesture: true });
      // entries[0] is always the root directory record itself (walkDirectory
      // pushes it before recursing) — scope the watcher to its subtree.
      await this.watcher.watchDirectory(dirHandle, persisted[0]?.id);
    }

    return { dirHandle, entries: persisted };
  }

  async list(parentId?: string): Promise<FsEntry[]> {
    const records = await this.store.list({ parentId });
    return records.map(recordToEntry);
  }

  async get(id: string): Promise<FsEntry | null> {
    const rec = await this.store.get(id);
    return rec ? recordToEntry(rec) : null;
  }

  async readFile(id: string, withinGesture = false): Promise<File | null> {
    const rec = await this.store.get(id);
    if (!rec || rec.kind !== 'file') return null;

    if (rec.handle) {
      const result = await this.permissions.ensure([rec.handle], 'read', {
        withinGesture,
      });
      if (result.granted.length === 0) return null;
    }

    return this.store.getFileForRecord(rec);
  }

  async saveAs(data: Blob | File, options?: Parameters<Saver['saveAs']>[1]): Promise<void> {
    await this.saver.saveAs(data, options);
  }

  async saveInPlace(
    handle: FileSystemFileHandle,
    data: Blob | File,
    withinGesture = true
  ): Promise<void> {
    await this.permissions.ensure([handle], 'readwrite', { withinGesture });
    await this.saver.saveInPlace(handle, data);
  }

  async remove(id: string): Promise<void> {
    await this.store.remove(id);
    this.emit('remove', id);
  }

  async reconnect(withinGesture = true): Promise<import('./types').PermissionResult> {
    const pending = this.permissions.pending();
    const records = await this.store.list();
    const handles = records
      .map(r => r.handle)
      .filter((h): h is FileSystemHandle => h !== undefined);

    const unique = [...new Set([...pending, ...handles])];
    return this.permissions.ensure(unique, 'read', { withinGesture });
  }

  pendingPermissions(): FileSystemHandle[] {
    return this.permissions.pending();
  }

  async readMetadata(id: string, withinGesture = false): Promise<ImageMetadata | null> {
    const file = await this.readFile(id, withinGesture);
    if (!file) return null;
    return this.metadataReader.read(file);
  }

  async getThumbnail(id: string, withinGesture = false): Promise<Blob | null> {
    const file = await this.readFile(id, withinGesture);
    if (!file) return null;
    return this.thumbnailCache.getOrCreate(id, file);
  }

  async decodeRaw(id: string, withinGesture = false): Promise<import('./raw/index').RawDecodeResult | null> {
    if (!this.rawDecoder) {
      throw new Error('uploadzx/fs: no RawDecoder configured. Call setRawDecoder() first.');
    }
    const file = await this.readFile(id, withinGesture);
    if (!file || !this.rawDecoder.supports(file.name)) return null;
    return this.rawDecoder.decode(file);
  }

  watchDirectory(dirHandle: FileSystemDirectoryHandle): Promise<void> {
    return this.watcher.watchDirectory(dirHandle);
  }

  stopWatching(): void {
    this.watcher.stop();
  }

  destroy(): void {
    this.stopWatching();
    this.removeAll();
    this.permissions.reset();
  }

  private async persistEntries(entries: FsEntry[], withinGesture: boolean): Promise<FsEntry[]> {
    const out: FsEntry[] = [];
    const handles = entries.map(e => e.handle).filter((h): h is FileSystemHandle => !!h);

    if (handles.length > 0) {
      await this.permissions.ensure(handles, 'read', { withinGesture });
    }

    for (const entry of entries) {
      if (entry.kind === 'directory') {
        const rec = createRecordFromHandle(entry.handle!, {
          id: entry.id,
          parentId: entry.parentId,
          relPath: entry.relPath,
        });
        await this.store.put(rec);
        out.push(recordToEntry(rec));
        continue;
      }

      const rec = createRecordFromHandle(entry.handle!, {
        id: entry.id,
        parentId: entry.parentId,
        relPath: entry.relPath,
        file: entry.file,
      });

      let stored = rec;
      if (entry.file) {
        try {
          stored = await this.store.cacheFileIfNeeded(rec, entry.file);
        } catch (error) {
          // A single file failing to cache (e.g. storage quota) shouldn't lose
          // the rest of the batch — persist its metadata and surface the error.
          this.logger.warn(`Failed to cache "${entry.file.name}":`, error);
          this.emit('error', error instanceof Error ? error : new Error(String(error)));
        }
      }
      await this.store.put(stored);
      const persisted = recordToEntry(stored);
      out.push({ ...persisted, file: entry.file, handle: entry.handle });
      this.emit('add', { ...persisted, file: entry.file });
    }

    return out;
  }
}
