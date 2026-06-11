import type { IntegrityAlgorithm } from '../../types';

/**
 * Messages sent from {@link HashWorkerClient} to the hashing worker. Each
 * request carries a monotonic `id` so the client can correlate the matching
 * response; a single `id` runs a sequential lifecycle:
 * `init` -> `update`* -> `finalize` (or `dispose` to abort).
 */
export type HashWorkerRequest =
  | { type: 'init'; id: number; algorithm: IntegrityAlgorithm }
  | { type: 'update'; id: number; chunk: ArrayBuffer }
  | { type: 'finalize'; id: number }
  | { type: 'dispose'; id: number };

/** Messages sent from the hashing worker back to {@link HashWorkerClient}. */
export type HashWorkerResponse =
  | { type: 'ready'; id: number }
  | { type: 'updated'; id: number }
  | { type: 'digest'; id: number; hex: string }
  | { type: 'error'; id: number; message: string };
