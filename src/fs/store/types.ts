import type { FsRecord } from '../types';

export interface StorageAdapter {
  init(): Promise<void>;
  put(rec: FsRecord): Promise<void>;
  get(id: string): Promise<FsRecord | null>;
  list(opts?: { parentId?: string }): Promise<FsRecord[]>;
  remove(id: string): Promise<void>;
  putCachedBytes(key: string, blob: Blob): Promise<void>;
  getCachedBytes(key: string): Promise<Blob | null>;
  removeCachedBytes(key: string): Promise<void>;
  putThumb(key: string, blob: Blob): Promise<void>;
  getThumb(key: string): Promise<Blob | null>;
  removeThumb(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface ThumbMeta {
  key: string;
  size: number;
  lastAccessed: number;
  /** Monotonic tiebreaker for eviction ordering when `lastAccessed` ties (same ms). */
  seq: number;
}
