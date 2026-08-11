/**
 * Public entry point for the optional integrity-hashing feature. This module
 * (and the worker + wasm it pulls in) is only loaded when a consumer enables
 * `integrity` on the queue, or imports `uploadzx/integrity` directly.
 */
export {
  DEFAULT_HASH_CHUNK_SIZE,
  type HashFileOptions,
  type IntegrityHasher,
} from './IntegrityHasher';
export { HashWorkerClient, type HashWorkerClientOptions } from './HashWorkerClient';
export { createWorkerHasher, type LazyWorkerHasherOptions } from './lazyHasher';
export {
  IntegrityCoordinator,
  resolveIntegrityOptions,
  type ResolvedIntegrityOptions,
  type GetDigestOptions,
} from './IntegrityCoordinator';
export type { HashWorkerRequest, HashWorkerResponse } from './worker/protocol';
