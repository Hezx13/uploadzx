import type { IntegrityDigest } from '../types';
import { DEFAULT_HASH_CHUNK_SIZE } from './IntegrityHasher';
import type { HashFileOptions, IntegrityHasher } from './IntegrityHasher';
import type { HashWorkerRequest, HashWorkerResponse } from './worker/protocol';

export interface HashWorkerClientOptions {
  /**
   * Construct the worker yourself. Provide this when your bundler can't resolve
   * the default `new URL('./worker/hash.worker.js', import.meta.url)` reference.
   */
  workerFactory?: () => Worker;
}

/**
 * Main-thread proxy to the hashing worker. Spawns a single shared worker lazily,
 * slices each file into bounded chunks, and streams them in as transferable
 * `ArrayBuffer`s (zero-copy). Updates are awaited one at a time, which both
 * bounds memory and provides natural backpressure.
 */
export class HashWorkerClient implements IntegrityHasher {
  private readonly options: HashWorkerClientOptions;
  private worker?: Worker;
  private nextId = 1;
  /** One-shot resolvers keyed by request id; each id is strictly sequential. */
  private readonly pending = new Map<number, (msg: HashWorkerResponse) => void>();

  constructor(options: HashWorkerClientOptions = {}) {
    this.options = options;
  }

  async hashFile(file: Blob, options: HashFileOptions): Promise<IntegrityDigest> {
    const worker = this.ensureWorker();
    const id = this.nextId++;
    const chunkSize = options.chunkSize ?? DEFAULT_HASH_CHUNK_SIZE;
    const total = file.size;
    const { signal } = options;

    const throwIfAborted = () => {
      if (signal?.aborted) {
        throw new DOMException('Hashing aborted', 'AbortError');
      }
    };

    const onAbort = () => {
      // Best-effort teardown of the in-worker hasher; resolvers reject below.
      worker.postMessage({ type: 'dispose', id } satisfies HashWorkerRequest);
      const resolver = this.pending.get(id);
      if (resolver) {
        this.pending.delete(id);
        resolver({ type: 'error', id, message: 'aborted' });
      }
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      throwIfAborted();
      await this.request({ type: 'init', id, algorithm: options.algorithm });

      let offset = 0;
      while (offset < total) {
        throwIfAborted();
        const end = Math.min(offset + chunkSize, total);
        const buffer = await file.slice(offset, end).arrayBuffer();
        await this.request({ type: 'update', id, chunk: buffer }, [buffer]);
        offset = end;
        options.onProgress?.(offset, total);
      }

      throwIfAborted();
      const result = await this.request({ type: 'finalize', id });
      if (result.type !== 'digest') {
        throw new Error('uploadzx: unexpected hashing response');
      }
      return { algorithm: options.algorithm, hex: result.hex };
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.pending.clear();
  }

  /** Post a request and await the single response carrying the same id. */
  private request(req: HashWorkerRequest, transfer?: Transferable[]): Promise<HashWorkerResponse> {
    const worker = this.ensureWorker();
    return new Promise<HashWorkerResponse>((resolve, reject) => {
      this.pending.set(req.id, msg => {
        if (msg.type === 'error') {
          reject(
            msg.message === 'aborted'
              ? new DOMException('Hashing aborted', 'AbortError')
              : new Error(msg.message)
          );
        } else {
          resolve(msg);
        }
      });
      worker.postMessage(req, transfer ?? []);
    });
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    if (this.options.workerFactory) {
      this.worker = this.options.workerFactory();
    } else {
      // Modern-bundler idiom; Vite / Webpack 5 / Next understand this and emit
      // the worker (and its wasm) as separate assets. Bundlers that don't should
      // pass `workerFactory`.
      this.worker = new Worker(new URL('./worker/hash.worker.js', import.meta.url), {
        type: 'module',
      });
    }

    this.worker.addEventListener('message', (event: MessageEvent<HashWorkerResponse>) => {
      const msg = event.data;
      const resolver = this.pending.get(msg.id);
      if (resolver) {
        this.pending.delete(msg.id);
        resolver(msg);
      }
    });

    return this.worker;
  }
}
