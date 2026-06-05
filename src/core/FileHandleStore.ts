import { PersistenceAdapter, StoredFileHandle } from '../types';
import { createLogger, isFileSystemAccessSupported, Logger } from '../utils';

/** Safari metadata record — intentionally does NOT hold the file bytes. */
interface SafariFileMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  tusUploadUrl?: string;
  bytesUploaded?: number;
  /** Legacy inline payload from schema v2. Read-only fallback. */
  data?: ArrayBuffer;
}

/** Safari payload record — the bytes live here, read only when resuming. */
interface SafariBlobRecord {
  id: string;
  blob: Blob;
}

export class FileHandleStore implements PersistenceAdapter {
  private dbName = 'uploadzx-filehandles';
  private version = 3; // v3: split Safari metadata from blob payloads
  private storeName = 'filehandles';
  private safariMetaStore = 'safari-files';
  private safariBlobStore = 'safari-blobs';
  private isFileSystemAccessSupported = isFileSystemAccessSupported();
  private logger: Logger;

  private dbPromise?: Promise<IDBDatabase>;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger(false);
  }

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        const db = request.result;
        // If another tab triggers a version bump, close so it isn't blocked and
        // drop our memoized handle so the next call reopens cleanly.
        db.onversionchange = () => {
          db.close();
          this.dbPromise = undefined;
        };
        resolve(db);
      };

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains(this.safariMetaStore)) {
          const meta = db.createObjectStore(this.safariMetaStore, { keyPath: 'id' });
          meta.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains(this.safariBlobStore)) {
          db.createObjectStore(this.safariBlobStore, { keyPath: 'id' });
        }
      };
    });

    // If opening fails, don't cache the rejected promise forever.
    this.dbPromise.catch(() => {
      this.dbPromise = undefined;
    });

    return this.dbPromise;
  }

  /** Wraps a transaction so the returned promise settles on commit, not before. */
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
            // Reads have no commit step worth waiting on; resolve immediately.
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

  async storeFileHandle(fileHandle: FileSystemFileHandle, id: string): Promise<void> {
    if (this.isFileSystemAccessSupported) {
      return this.storeNativeFileHandle(fileHandle, id);
    }
    const file = await fileHandle.getFile();
    return this.storeSafariFile(file, id);
  }

  private async storeNativeFileHandle(fileHandle: FileSystemFileHandle, id: string): Promise<void> {
    const file = await fileHandle.getFile();
    const storedHandle: StoredFileHandle = {
      id,
      name: file.name,
      size: file.size,
      type: file.type,
      handle: fileHandle,
      lastModified: file.lastModified,
    };

    await this.tx(this.storeName, 'readwrite', tx => {
      tx.objectStore(this.storeName).put(storedHandle);
    });
  }

  private async storeSafariFile(file: File, id: string): Promise<void> {
    const meta: SafariFileMeta = {
      id,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    };

    await this.tx([this.safariMetaStore, this.safariBlobStore], 'readwrite', tx => {
      tx.objectStore(this.safariMetaStore).put(meta);
      // Store the File (a Blob) directly — kept disk-backed by IndexedDB.
      tx.objectStore(this.safariBlobStore).put({ id, blob: file } as SafariBlobRecord);
    });
  }

  async getFileHandle(id: string): Promise<StoredFileHandle | null> {
    if (this.isFileSystemAccessSupported) {
      return this.tx(this.storeName, 'readonly', async tx => {
        const result = await this.reqToPromise(tx.objectStore(this.storeName).get(id));
        return (result as StoredFileHandle) || null;
      });
    }

    const meta = await this.tx(this.safariMetaStore, 'readonly', tx =>
      this.reqToPromise<SafariFileMeta | undefined>(tx.objectStore(this.safariMetaStore).get(id))
    );
    return meta ? this.metaToStoredHandle(meta) : null;
  }

  /** Builds a StoredFileHandle from Safari metadata, lazily fetching the blob on demand. */
  private metaToStoredHandle(meta: SafariFileMeta): StoredFileHandle {
    const handle = {
      kind: 'file' as const,
      name: meta.name,
      getFile: async () => {
        const file = await this.getSafariFileByID(meta.id);
        if (!file) {
          throw new Error(`uploadzx: cached file for "${meta.name}" is no longer available`);
        }
        return file;
      },
      queryPermission: async () => 'granted' as PermissionState,
      requestPermission: async () => 'granted' as PermissionState,
      createWritable: async () => {
        throw new Error('Write operations not supported in Safari fallback mode');
      },
      isSameEntry: async () => false,
    } as unknown as FileSystemFileHandle;

    return {
      id: meta.id,
      name: meta.name,
      size: meta.size,
      type: meta.type,
      handle,
      lastModified: meta.lastModified,
      tusUploadUrl: meta.tusUploadUrl,
      bytesUploaded: meta.bytesUploaded,
    };
  }

  async getAllFileHandles(): Promise<StoredFileHandle[]> {
    if (this.isFileSystemAccessSupported) {
      return this.tx(this.storeName, 'readonly', tx =>
        this.reqToPromise<StoredFileHandle[]>(tx.objectStore(this.storeName).getAll())
      );
    }

    // Listing unfinished uploads reads metadata ONLY — the blobs stay on disk.
    const metas = await this.tx(this.safariMetaStore, 'readonly', tx =>
      this.reqToPromise<SafariFileMeta[]>(tx.objectStore(this.safariMetaStore).getAll())
    );
    return metas.map(meta => this.metaToStoredHandle(meta));
  }

  async removeFileHandle(id: string): Promise<void> {
    this.logger.debug('removeFileHandle', id);
    if (this.isFileSystemAccessSupported) {
      await this.tx(this.storeName, 'readwrite', tx => {
        tx.objectStore(this.storeName).delete(id);
      });
      return;
    }
    await this.tx([this.safariMetaStore, this.safariBlobStore], 'readwrite', tx => {
      tx.objectStore(this.safariMetaStore).delete(id);
      tx.objectStore(this.safariBlobStore).delete(id);
    });
  }

  async updateFileHandleProgress(
    id: string,
    tusUploadUrl: string,
    bytesUploaded: number
  ): Promise<void> {
    const storeName = this.isFileSystemAccessSupported ? this.storeName : this.safariMetaStore;

    // Read-modify-write touches only the small metadata record — never the blob.
    await this.tx(storeName, 'readwrite', async tx => {
      const store = tx.objectStore(storeName);
      const record = await this.reqToPromise<StoredFileHandle | SafariFileMeta | undefined>(
        store.get(id)
      );
      if (!record) return;
      record.tusUploadUrl = tusUploadUrl;
      record.bytesUploaded = bytesUploaded;
      store.put(record);
    });
  }

  async verifyPermission(fileHandle: FileSystemFileHandle): Promise<boolean> {
    // Safari fallback handles always "have" permission since we hold the data.
    if (!this.isFileSystemAccessSupported) {
      return true;
    }

    try {
      const handle = fileHandle as FileSystemFileHandle & {
        queryPermission(d: { mode: string }): Promise<PermissionState>;
        requestPermission(d: { mode: string }): Promise<PermissionState>;
      };
      const permission = await handle.queryPermission({ mode: 'read' });
      if (permission === 'granted') return true;

      if (permission === 'prompt') {
        const requested = await handle.requestPermission({ mode: 'read' });
        return requested === 'granted';
      }
      return false;
    } catch (error) {
      // Typically thrown when called outside a user gesture — NOT a denial.
      this.logger.warn('Permission check failed (likely no user gesture):', error);
      return false;
    }
  }

  async getFileFromHandleByID(id: string): Promise<File | null> {
    this.logger.debug('getFileFromHandleByID', id);
    if (!this.isFileSystemAccessSupported) {
      return this.getSafariFileByID(id);
    }

    const stored = await this.getFileHandle(id);
    if (!stored) return null;

    const hasPermission = await this.verifyPermission(stored.handle);
    if (!hasPermission) {
      // Could not (re)acquire read permission. This is commonly because we are
      // outside a user gesture, NOT because the user denied access — so we keep
      // the handle for a later, gesture-driven retry instead of destroying it.
      this.logger.warn(
        `Read permission not granted for "${stored.name}". Keeping handle for a later user-initiated retry.`
      );
      return null;
    }

    try {
      return await stored.handle.getFile();
    } catch (error) {
      this.logger.error('Failed to read file from handle:', error);
      return null;
    }
  }

  private async getSafariFileByID(id: string): Promise<File | null> {
    const meta = await this.tx(this.safariMetaStore, 'readonly', tx =>
      this.reqToPromise<SafariFileMeta | undefined>(tx.objectStore(this.safariMetaStore).get(id))
    );
    if (!meta) return null;

    const blobRecord = await this.tx(this.safariBlobStore, 'readonly', tx =>
      this.reqToPromise<SafariBlobRecord | undefined>(tx.objectStore(this.safariBlobStore).get(id))
    );

    // Prefer the split blob store; fall back to a legacy inline ArrayBuffer (v2).
    const source: BlobPart | undefined = blobRecord?.blob ?? meta.data;
    if (!source) return null;

    return new File([source], meta.name, {
      type: meta.type,
      lastModified: meta.lastModified,
    });
  }

  async clear(): Promise<void> {
    this.logger.debug('clear');
    const db = await this.openDB();
    const storeNames = Array.from(db.objectStoreNames);

    await this.tx(storeNames, 'readwrite', tx => {
      for (const name of storeNames) {
        tx.objectStore(name).clear();
      }
    });
  }
}
