import type { FsRecord, FsStoreOptions } from '../types';
import { CURRENT_RECORD_SCHEMA_VERSION } from '../types';
import { normalizeRecord, thumbKeyFor } from '../utils';
import {
  createLogger,
  isBrowser,
  isFileSystemAccessSupported,
  isSyntheticHandle,
  Logger,
} from '../../utils';
import type { StorageAdapter, ThumbMeta } from './types';
import {
  DB_VERSION,
  runMigrations,
  STORE_CACHED_BYTES,
  STORE_HANDLES,
  STORE_RECORDS,
  STORE_THUMB_META,
  STORE_THUMBS,
} from './migrations';

const DEFAULT_MAX_CACHED = 50 * 1024 * 1024;
const DEFAULT_THUMB_BUDGET = 100 * 1024 * 1024;

interface HandleRecord {
  id: string;
  handle: FileSystemHandle;
}

interface CachedBytesRecord {
  key: string;
  blob: Blob;
}

interface ThumbRecord {
  key: string;
  blob: Blob;
}

export class FsStore implements StorageAdapter {
  private dbName: string;
  private maxCachedFileBytes: number;
  private thumbCacheBudgetBytes: number;
  private logger: Logger;
  private dbPromise?: Promise<IDBDatabase>;
  private hasNativeHandles: boolean;
  /** Monotonic counter breaking ties when `Date.now()` collides across thumb accesses. */
  private thumbSeq = 0;

  constructor(options: FsStoreOptions = {}) {
    this.dbName = options.dbName ?? 'uploadzx-fs';
    this.maxCachedFileBytes = options.maxCachedFileBytes ?? DEFAULT_MAX_CACHED;
    this.thumbCacheBudgetBytes = options.thumbCacheBudgetBytes ?? DEFAULT_THUMB_BUDGET;
    this.logger = createLogger(options.debug ?? false);
    this.hasNativeHandles = isFileSystemAccessSupported();
  }

  async init(): Promise<void> {
    await this.openDB();
  }

  private openDB(): Promise<IDBDatabase> {
    if (!isBrowser()) {
      return Promise.reject(new Error('uploadzx/fs: IndexedDB is not available in this environment'));
    }
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.dbPromise = undefined;
        };
        resolve(db);
      };

      request.onupgradeneeded = event => {
        const db = request.result;
        const tx = request.transaction!;
        const oldVersion = event.oldVersion;
        runMigrations(db, tx, oldVersion, DB_VERSION);
      };
    });

    this.dbPromise.catch(() => {
      this.dbPromise = undefined;
    });

    return this.dbPromise;
  }

  private async tx<T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    work: (tx: IDBTransaction) => Promise<T> | T
  ): Promise<T> {
    const db = await this.openDB();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeNames, mode);
      let result: T;
      let settled = false;

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);

      Promise.resolve(work(transaction))
        .then(value => {
          result = value;
          settled = true;
          if (mode === 'readonly') {
            resolve(result);
          }
        })
        .catch(err => {
          if (!settled) {
            try {
              transaction.abort();
            } catch {
              /* already aborting */
            }
            reject(err);
          }
        });
    });
  }

  private reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(rec: FsRecord): Promise<void> {
    const { handle, ...meta } = normalizeRecord({
      ...rec,
      schemaVersion: rec.schemaVersion ?? CURRENT_RECORD_SCHEMA_VERSION,
      updatedAt: Date.now(),
    });
    // Synthetic (in-memory) handle shims carry closures and can't survive a
    // structured clone into IndexedDB; only real, persistable handles go in
    // STORE_HANDLES. See isSyntheticHandle.
    const persistHandle = handle && this.hasNativeHandles && !isSyntheticHandle(handle);
    const stores = persistHandle ? [STORE_RECORDS, STORE_HANDLES] : [STORE_RECORDS];
    await this.tx(stores, 'readwrite', tx => {
      tx.objectStore(STORE_RECORDS).put(meta);
      if (persistHandle) {
        tx.objectStore(STORE_HANDLES).put({ id: rec.id, handle } satisfies HandleRecord);
      }
    });
  }

  async get(id: string): Promise<FsRecord | null> {
    const meta = await this.tx(STORE_RECORDS, 'readonly', tx =>
      this.reqToPromise<Omit<FsRecord, 'handle'> | undefined>(tx.objectStore(STORE_RECORDS).get(id))
    );
    if (!meta) return null;

    let handle: FileSystemHandle | undefined;
    if (this.hasNativeHandles) {
      const handleRec = await this.tx(STORE_HANDLES, 'readonly', tx =>
        this.reqToPromise<HandleRecord | undefined>(tx.objectStore(STORE_HANDLES).get(id))
      );
      handle = handleRec?.handle;
    }

    return normalizeRecord({ ...meta, handle } as FsRecord);
  }

  async list(opts?: { parentId?: string }): Promise<FsRecord[]> {
    const all = await this.tx(STORE_RECORDS, 'readonly', tx =>
      this.reqToPromise<FsRecord[]>(tx.objectStore(STORE_RECORDS).getAll())
    );
    const filtered =
      opts?.parentId === undefined ? all : all.filter(r => r.parentId === opts.parentId);

    if (!this.hasNativeHandles) {
      return filtered.map(normalizeRecord);
    }

    const handleRecords = await this.tx(STORE_HANDLES, 'readonly', tx =>
      this.reqToPromise<HandleRecord[]>(tx.objectStore(STORE_HANDLES).getAll())
    );
    const handleById = new Map(handleRecords.map(h => [h.id, h.handle]));
    return filtered.map(r => normalizeRecord({ ...r, handle: handleById.get(r.id) } as FsRecord));
  }

  async remove(id: string): Promise<void> {
    const rec = await this.get(id);
    if (rec?.cachedBytesKey) {
      await this.removeCachedBytes(rec.cachedBytesKey);
    }
    // ThumbnailCache always writes under the `thumb-${id}` convention (see
    // thumbKeyFor) rather than through `rec.thumbKey`, which nothing ever
    // sets — clean up by convention so thumbnails don't outlive their record.
    await this.removeThumb(rec?.thumbKey ?? thumbKeyFor(id));
    const stores = this.hasNativeHandles
      ? [STORE_RECORDS, STORE_HANDLES]
      : [STORE_RECORDS];
    await this.tx(stores, 'readwrite', tx => {
      tx.objectStore(STORE_RECORDS).delete(id);
      if (this.hasNativeHandles) {
        tx.objectStore(STORE_HANDLES).delete(id);
      }
    });
  }

  async putCachedBytes(key: string, blob: Blob): Promise<void> {
    if (this.hasNativeHandles) {
      this.logger.debug('Skipping byte cache on native handle platform');
      return;
    }
    if (blob.size > this.maxCachedFileBytes) {
      throw new Error(
        `uploadzx/fs: file too large to cache (${blob.size} bytes, max ${this.maxCachedFileBytes})`
      );
    }
    await this.assertQuota(blob.size);
    await this.tx(STORE_CACHED_BYTES, 'readwrite', tx => {
      tx.objectStore(STORE_CACHED_BYTES).put({ key, blob } satisfies CachedBytesRecord);
    });
  }

  async getCachedBytes(key: string): Promise<Blob | null> {
    const rec = await this.tx(STORE_CACHED_BYTES, 'readonly', tx =>
      this.reqToPromise<CachedBytesRecord | undefined>(
        tx.objectStore(STORE_CACHED_BYTES).get(key)
      )
    );
    return rec?.blob ?? null;
  }

  async removeCachedBytes(key: string): Promise<void> {
    await this.tx(STORE_CACHED_BYTES, 'readwrite', tx => {
      tx.objectStore(STORE_CACHED_BYTES).delete(key);
    });
  }

  async putThumb(key: string, blob: Blob): Promise<void> {
    await this.evictThumbsIfNeeded(blob.size);
    const now = Date.now();
    const seq = this.thumbSeq++;
    await this.tx([STORE_THUMBS, STORE_THUMB_META], 'readwrite', tx => {
      tx.objectStore(STORE_THUMBS).put({ key, blob } satisfies ThumbRecord);
      tx.objectStore(STORE_THUMB_META).put({
        key,
        size: blob.size,
        lastAccessed: now,
        seq,
      } satisfies ThumbMeta);
    });
  }

  async getThumb(key: string): Promise<Blob | null> {
    const rec = await this.tx(STORE_THUMBS, 'readonly', tx =>
      this.reqToPromise<ThumbRecord | undefined>(tx.objectStore(STORE_THUMBS).get(key))
    );
    if (rec?.blob) {
      await this.touchThumbMeta(key, rec.blob.size);
    }
    return rec?.blob ?? null;
  }

  async removeThumb(key: string): Promise<void> {
    await this.tx([STORE_THUMBS, STORE_THUMB_META], 'readwrite', tx => {
      tx.objectStore(STORE_THUMBS).delete(key);
      tx.objectStore(STORE_THUMB_META).delete(key);
    });
  }

  private async touchThumbMeta(key: string, size: number): Promise<void> {
    await this.tx(STORE_THUMB_META, 'readwrite', tx => {
      tx.objectStore(STORE_THUMB_META).put({
        key,
        size,
        lastAccessed: Date.now(),
        seq: this.thumbSeq++,
      } satisfies ThumbMeta);
    });
  }

  private async getThumbMetaTotal(): Promise<{ total: number; entries: ThumbMeta[] }> {
    const entries = await this.tx(STORE_THUMB_META, 'readonly', tx =>
      this.reqToPromise<ThumbMeta[]>(tx.objectStore(STORE_THUMB_META).getAll())
    );
    const total = entries.reduce((sum, e) => sum + e.size, 0);
    return { total, entries };
  }

  private async evictThumbsIfNeeded(incomingSize: number): Promise<void> {
    const { total, entries } = await this.getThumbMetaTotal();
    if (total + incomingSize <= this.thumbCacheBudgetBytes) return;

    const sorted = [...entries].sort(
      (a, b) => a.lastAccessed - b.lastAccessed || a.seq - b.seq
    );
    let freed = 0;
    const target = total + incomingSize - this.thumbCacheBudgetBytes;

    for (const entry of sorted) {
      if (freed >= target) break;
      await this.removeThumb(entry.key);
      freed += entry.size;
    }
  }

  async clear(): Promise<void> {
    const db = await this.openDB();
    const storeNames = Array.from(db.objectStoreNames);
    await this.tx(storeNames, 'readwrite', tx => {
      for (const name of storeNames) {
        tx.objectStore(name).clear();
      }
    });
  }

  async getFileForRecord(rec: FsRecord): Promise<File | null> {
    if (rec.handle && rec.kind === 'file') {
      try {
        const fileHandle = rec.handle as FileSystemFileHandle;
        return await fileHandle.getFile();
      } catch (error) {
        this.logger.warn(`Failed to read file from handle "${rec.name}":`, error);
      }
    }
    if (rec.cachedBytesKey) {
      const blob = await this.getCachedBytes(rec.cachedBytesKey);
      if (blob) {
        return new File([blob], rec.name, {
          type: rec.type ?? 'application/octet-stream',
          lastModified: rec.lastModified ?? Date.now(),
        });
      }
    }
    return null;
  }

  async cacheFileIfNeeded(rec: FsRecord, file: File): Promise<FsRecord> {
    const handlePersistable =
      this.hasNativeHandles && !!rec.handle && !isSyntheticHandle(rec.handle);
    if (handlePersistable || rec.cachedBytesKey) {
      return rec;
    }
    if (file.size > this.maxCachedFileBytes) {
      this.logger.warn(
        `"${rec.name}" (${file.size} bytes) exceeds maxCachedFileBytes (${this.maxCachedFileBytes}); ` +
          'skipping byte cache, it will not survive a reload.'
      );
      return rec;
    }
    const key = rec.cachedBytesKey ?? `cache-${rec.id}`;
    await this.putCachedBytes(key, file);
    return { ...rec, cachedBytesKey: key, updatedAt: Date.now() };
  }

  private async assertQuota(size: number): Promise<void> {
    const storage = (navigator as Navigator & { storage?: StorageManager }).storage;
    if (!storage?.estimate) return;

    try {
      const { usage = 0, quota = 0 } = await storage.estimate();
      if (quota > 0 && usage + size > quota * 0.95) {
        throw new Error(
          `uploadzx/fs: insufficient storage (need ${size} bytes, ` +
            `${Math.max(0, quota - usage)} available)`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('uploadzx/fs:')) {
        throw error;
      }
      this.logger.warn('storage.estimate() failed; skipping quota check:', error);
    }
  }
}
