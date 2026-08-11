import type { IntegrityDigest } from '../types';
import type { HashFileOptions, IntegrityHasher } from './IntegrityHasher';

export interface LazyWorkerHasherOptions {
  workerFactory?: () => Worker;
}

/**
 * A worker-backed {@link IntegrityHasher} whose implementation
 * ({@link HashWorkerClient}, and through it the wasm module) is only loaded via
 * dynamic `import()` on first use. This keeps the worker + wasm out of the core
 * bundle for consumers who never enable integrity hashing.
 */
export function createWorkerHasher(options: LazyWorkerHasherOptions = {}): IntegrityHasher {
  let inner: IntegrityHasher | undefined;
  let loading: Promise<IntegrityHasher> | undefined;

  const load = (): Promise<IntegrityHasher> => {
    if (inner) return Promise.resolve(inner);
    if (!loading) {
      loading = import('./HashWorkerClient').then(mod => {
        inner = new mod.HashWorkerClient(options);
        return inner;
      });
    }
    return loading;
  };

  return {
    async hashFile(file: Blob, opts: HashFileOptions): Promise<IntegrityDigest> {
      const hasher = await load();
      return hasher.hashFile(file, opts);
    },
    dispose(): void {
      inner?.dispose?.();
    },
  };
}
