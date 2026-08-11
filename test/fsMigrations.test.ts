import { describe, it, expect, beforeEach } from 'vitest';
import { DB_VERSION, migrations, runMigrations, STORE_HANDLES, STORE_RECORDS } from '../src/fs/store/migrations';

describe('fs migrations', () => {
  it('exports a positive DB_VERSION', () => {
    expect(DB_VERSION).toBeGreaterThan(0);
    expect(migrations.length).toBeGreaterThanOrEqual(DB_VERSION);
  });

  it('creates all object stores on fresh install', () => {
    const created: string[] = [];
    const mockDb = {
      objectStoreNames: { contains: (n: string) => created.includes(n) },
      createObjectStore: (name: string) => {
        created.push(name);
        return { createIndex: () => {} };
      },
    } as unknown as IDBDatabase;

    const mockTx = {} as IDBTransaction;
    runMigrations(mockDb, mockTx, 0, DB_VERSION);

    expect(created).toContain(STORE_RECORDS);
    expect(created).toContain(STORE_HANDLES);
    expect(created).toContain('cached-bytes');
    expect(created).toContain('thumbs');
    expect(created).toContain('thumb-meta');
  });
});
