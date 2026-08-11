/** Single source of truth for IndexedDB schema version. Bump when migrations change. */
export const DB_VERSION = 2;

export const STORE_RECORDS = 'records';
export const STORE_HANDLES = 'handles';
export const STORE_CACHED_BYTES = 'cached-bytes';
export const STORE_THUMBS = 'thumbs';
export const STORE_THUMB_META = 'thumb-meta';

export type MigrationFn = (db: IDBDatabase, tx: IDBTransaction, fromVersion: number) => void;

export const migrations: MigrationFn[] = [
  (db, _tx, fromVersion) => {
    if (fromVersion < 1) {
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        const records = db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
        records.createIndex('parentId', 'parentId', { unique: false });
        records.createIndex('name', 'name', { unique: false });
        records.createIndex('kind', 'kind', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CACHED_BYTES)) {
        db.createObjectStore(STORE_CACHED_BYTES, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_THUMBS)) {
        db.createObjectStore(STORE_THUMBS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_THUMB_META)) {
        const meta = db.createObjectStore(STORE_THUMB_META, { keyPath: 'key' });
        meta.createIndex('lastAccessed', 'lastAccessed', { unique: false });
      }
    }
  },
  (db, _tx, fromVersion) => {
    if (fromVersion < 2 && !db.objectStoreNames.contains(STORE_HANDLES)) {
      db.createObjectStore(STORE_HANDLES, { keyPath: 'id' });
    }
  },
];

export function runMigrations(
  db: IDBDatabase,
  tx: IDBTransaction,
  oldVersion: number,
  newVersion: number
): void {
  for (let v = oldVersion; v < newVersion; v++) {
    const migration = migrations[v];
    if (migration) {
      migration(db, tx, v);
    }
  }
}
