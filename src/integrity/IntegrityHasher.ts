import type { IntegrityAlgorithm, IntegrityDigest } from '../types';

/** Default file slice size fed to the hasher: 8 MiB. */
export const DEFAULT_HASH_CHUNK_SIZE = 8 * 1024 * 1024;

/** Options for a single {@link IntegrityHasher.hashFile} call. */
export interface HashFileOptions {
  /** Algorithm to hash with. */
  algorithm: IntegrityAlgorithm;
  /** Slice size in bytes. Defaults to {@link DEFAULT_HASH_CHUNK_SIZE}. */
  chunkSize?: number;
  /** Aborts the hash; the returned promise rejects with an `AbortError`. */
  signal?: AbortSignal;
  /** Reports cumulative bytes hashed so far against the total. */
  onProgress?: (bytesHashed: number, bytesTotal: number) => void;
}

/**
 * Streams a file through a content hasher in constant memory and returns its
 * digest. The default implementation ({@link HashWorkerClient}) runs a
 * Rust/wasm hasher inside a Web Worker; alternative implementations can be
 * injected via {@link IntegrityOptions.hasher} (e.g. for tests).
 */
export interface IntegrityHasher {
  hashFile(file: Blob, options: HashFileOptions): Promise<IntegrityDigest>;
  /** Release any backing resources (e.g. terminate the worker). */
  dispose?(): void;
}
