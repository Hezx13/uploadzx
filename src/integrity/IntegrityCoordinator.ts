import type { IntegrityDigest, IntegrityOptions } from '../types';
import { DEFAULT_HASH_CHUNK_SIZE } from './IntegrityHasher';
import type { IntegrityHasher } from './IntegrityHasher';

/** {@link IntegrityOptions} with all defaults resolved. */
export interface ResolvedIntegrityOptions {
  algorithm: NonNullable<IntegrityOptions['algorithm']>;
  verifyResume: boolean;
  sendToServer: boolean;
  metadataKey: string;
  dedup: boolean;
  chunkSize: number;
}

/** Fill in defaults for the user-supplied integrity options. */
export function resolveIntegrityOptions(options: IntegrityOptions): ResolvedIntegrityOptions {
  return {
    algorithm: options.algorithm ?? 'blake3',
    verifyResume: options.verifyResume ?? true,
    sendToServer: options.sendToServer ?? true,
    metadataKey: options.metadataKey ?? 'checksum',
    dedup: options.dedup ?? true,
    chunkSize: options.chunkSize ?? DEFAULT_HASH_CHUNK_SIZE,
  };
}

export interface GetDigestOptions {
  signal?: AbortSignal;
  onProgress?: (bytesHashed: number, bytesTotal: number) => void;
}

/**
 * Coordinates integrity hashing across the queue: computes each file's digest
 * once (deduping concurrent requests), caches it by file id, and tracks which
 * digests correspond to already-completed uploads so duplicates can be skipped.
 *
 * It owns no transport or persistence concerns — it is a small, testable policy
 * object the controller and queue delegate to.
 */
export class IntegrityCoordinator {
  private readonly hasher: IntegrityHasher;
  private readonly options: ResolvedIntegrityOptions;
  /** Digest cache keyed by file id. */
  private readonly cache = new Map<string, IntegrityDigest>();
  /** In-flight digest computations keyed by file id. */
  private readonly inFlight = new Map<string, Promise<IntegrityDigest>>();
  /** Completed digests keyed by hex, for dedup. */
  private readonly completed = new Map<string, { fileId: string; url?: string }>();

  constructor(hasher: IntegrityHasher, options: ResolvedIntegrityOptions) {
    this.hasher = hasher;
    this.options = options;
  }

  get resolvedOptions(): ResolvedIntegrityOptions {
    return this.options;
  }

  /** Returns the cached digest for a file id, if already computed. */
  getCached(fileId: string): IntegrityDigest | undefined {
    return this.cache.get(fileId);
  }

  /** Seed the cache with a known digest (e.g. one verified on resume). */
  seed(fileId: string, digest: IntegrityDigest): void {
    this.cache.set(fileId, digest);
  }

  /**
   * Compute (or return cached) the digest for a file. Concurrent calls for the
   * same id share a single hashing pass.
   */
  async getDigest(
    fileId: string,
    file: Blob,
    opts: GetDigestOptions = {}
  ): Promise<IntegrityDigest> {
    const cached = this.cache.get(fileId);
    if (cached) return cached;

    const existing = this.inFlight.get(fileId);
    if (existing) return existing;

    const promise = this.hasher
      .hashFile(file, {
        algorithm: this.options.algorithm,
        chunkSize: this.options.chunkSize,
        signal: opts.signal,
        onProgress: opts.onProgress,
      })
      .then(digest => {
        this.cache.set(fileId, digest);
        this.inFlight.delete(fileId);
        return digest;
      })
      .catch(err => {
        this.inFlight.delete(fileId);
        throw err;
      });

    this.inFlight.set(fileId, promise);
    return promise;
  }

  /**
   * Hash a file without touching the per-id cache. Used for resume verification,
   * where we re-hash the restored file to compare against the persisted digest.
   */
  computeDigest(file: Blob, signal?: AbortSignal): Promise<IntegrityDigest> {
    return this.hasher.hashFile(file, {
      algorithm: this.options.algorithm,
      chunkSize: this.options.chunkSize,
      signal,
    });
  }

  /** Record a completed upload's digest so future duplicates can be skipped. */
  markCompleted(digest: IntegrityDigest, fileId: string, url?: string): void {
    this.completed.set(digest.hex, { fileId, url });
  }

  /** Look up a completed upload by digest hex (dedup probe). */
  findCompleted(hex: string): { fileId: string; url?: string } | undefined {
    return this.completed.get(hex);
  }

  /** Forget a file's cached digest (e.g. on cancel). */
  forget(fileId: string): void {
    this.cache.delete(fileId);
    this.inFlight.delete(fileId);
  }

  dispose(): void {
    this.hasher.dispose?.();
    this.cache.clear();
    this.inFlight.clear();
    this.completed.clear();
  }
}
