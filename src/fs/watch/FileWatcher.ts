import { TypedEmitter } from '../../utils/emitter';
import type { FsEntry, FsRecord } from '../types';
import type { FsStore } from '../store/FsStore';
import { recordToEntry } from '../utils';

export interface WatchOptions {
  pollIntervalMs?: number;
  verifyHash?: boolean;
  hasher?: { hash(file: File): Promise<{ hex: string }> };
}

export interface WatchEvents {
  add: (entry: FsEntry) => void;
  change: (entry: FsEntry) => void;
  remove: (id: string) => void;
  error: (error: Error) => void;
  [key: string]: (...args: any[]) => void;
}

declare global {
  interface Window {
    FileSystemObserver?: new (
      callback: (records: FileSystemObserverRecord[]) => void
    ) => FileSystemObserver;
  }
}

interface FileSystemObserver {
  observe(handle: FileSystemHandle): void;
  disconnect(): void;
}

interface FileSystemObserverRecord {
  changedHandle: FileSystemHandle;
  relativePathComponents: string[];
  type: 'appeared' | 'disappeared' | 'modified' | 'moved' | 'unknown';
}

export class FileWatcher extends TypedEmitter<WatchEvents> {
  private store: FsStore;
  private options: WatchOptions;
  private observer?: FileSystemObserver;
  private pollTimer?: ReturnType<typeof setInterval>;
  private watched = new Map<string, { size?: number; lastModified?: number; hash?: string }>();
  private running = false;
  /** Restricts polling to descendants of this record id; undefined watches everything. */
  private rootId?: string;

  constructor(store: FsStore, options: WatchOptions = {}) {
    super();
    this.store = store;
    this.options = options;
  }

  async watchDirectory(dirHandle: FileSystemDirectoryHandle, rootId?: string): Promise<void> {
    this.stop();
    this.rootId = rootId;

    if (typeof window !== 'undefined' && window.FileSystemObserver) {
      try {
        this.observer = new window.FileSystemObserver(records => {
          this.handleObserverRecords(records).catch(error => this.emitError(error));
        });
        this.observer.observe(dirHandle);
        this.running = true;
        return;
      } catch {
        this.observer = undefined;
      }
    }

    await this.seedSnapshot();
    const interval = this.options.pollIntervalMs ?? 5000;
    this.pollTimer = setInterval(() => {
      this.poll().catch(error => this.emitError(error));
    }, interval);
    this.running = true;
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    this.watched.clear();
    this.rootId = undefined;
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  private emitError(error: unknown): void {
    this.emit('error', error instanceof Error ? error : new Error(String(error)));
  }

  private isWithinRoot(rec: FsRecord, byId: Map<string, FsRecord>): boolean {
    if (!this.rootId) return true;
    let current: FsRecord | undefined = rec;
    const seen = new Set<string>();
    while (current) {
      if (current.id === this.rootId) return true;
      if (!current.parentId || seen.has(current.id)) return false;
      seen.add(current.id);
      current = byId.get(current.parentId);
    }
    return false;
  }

  private async seedSnapshot(): Promise<void> {
    const records = await this.store.list();
    const byId = new Map(records.map(r => [r.id, r]));
    for (const rec of records) {
      if (rec.kind !== 'file' || !this.isWithinRoot(rec, byId)) continue;
      this.watched.set(rec.id, {
        size: rec.size,
        lastModified: rec.lastModified,
        hash: rec.hash?.hex,
      });
    }
  }

  private async poll(): Promise<void> {
    const records = await this.store.list();
    const byId = new Map(records.map(r => [r.id, r]));
    const seen = new Set<string>();

    for (const rec of records) {
      if (rec.kind !== 'file' || !this.isWithinRoot(rec, byId)) continue;
      seen.add(rec.id);

      // A cache-only record (no handle, Safari/Firefox fallback) has no
      // external file to drift from — its only meaningful transition is
      // first-sight ("add"), so we skip re-materializing its cached blob
      // out of IndexedDB on every tick.
      if (!rec.handle) {
        if (!this.watched.has(rec.id)) {
          this.watched.set(rec.id, { size: rec.size, lastModified: rec.lastModified });
          const file = await this.store.getFileForRecord(rec);
          if (file) this.emit('add', { ...recordToEntry(rec), file });
        }
        continue;
      }

      const file = await this.store.getFileForRecord(rec);
      if (!file) continue;

      const prev = this.watched.get(rec.id);
      const size = file.size;
      const lastModified = file.lastModified;

      if (!prev) {
        this.watched.set(rec.id, { size, lastModified });
        this.emit('add', { ...recordToEntry(rec), file });
        continue;
      }

      if (prev.size !== size || prev.lastModified !== lastModified) {
        this.watched.set(rec.id, { size, lastModified });
        this.emit('change', { ...recordToEntry(rec), file });
        continue;
      }

      if (this.options.verifyHash && this.options.hasher) {
        const digest = await this.options.hasher.hash(file);
        if (prev.hash && prev.hash !== digest.hex) {
          this.watched.set(rec.id, { size, lastModified, hash: digest.hex });
          this.emit('change', { ...recordToEntry(rec), file });
        }
      }
    }

    for (const [id] of this.watched) {
      if (!seen.has(id)) {
        this.watched.delete(id);
        this.emit('remove', id);
      }
    }
  }

  private async handleObserverRecords(records: FileSystemObserverRecord[]): Promise<void> {
    const all = await this.store.list();

    for (const record of records) {
      const match = all.find(r => r.handle && r.name === record.changedHandle.name);
      if (!match) {
        if (record.type === 'appeared') {
          const file =
            record.changedHandle.kind === 'file'
              ? await (record.changedHandle as FileSystemFileHandle).getFile()
              : undefined;
          const entry: FsEntry = {
            id: crypto.randomUUID(),
            kind: record.changedHandle.kind as 'file' | 'directory',
            name: record.changedHandle.name,
            handle: record.changedHandle,
            file,
          };
          this.emit('add', entry);
        }
        continue;
      }

      if (record.type === 'disappeared') {
        this.emit('remove', match.id);
        continue;
      }

      if (record.type === 'modified' || record.type === 'appeared' || record.type === 'moved') {
        const file =
          match.kind === 'file'
            ? await this.store.getFileForRecord(match)
            : undefined;
        this.emit('change', { ...recordToEntry(match), file: file ?? undefined });
      }
    }
  }
}
