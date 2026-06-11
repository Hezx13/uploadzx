/**
 * Dedicated Web Worker that hosts the Rust/wasm hasher. It keeps the wasm
 * module resident across requests and one {@link Hasher} instance per in-flight
 * request id, feeding it slices as they arrive and returning the hex digest on
 * finalize. Running here keeps multi-GB hashing off the main thread.
 */
import initWasm, { Hasher } from '../wasm/uploadzx_hash.js';
import type { HashWorkerRequest, HashWorkerResponse } from './protocol';

/** Minimal view of the worker global, avoiding DOM/WebWorker lib conflicts. */
interface WorkerScope {
  postMessage(message: HashWorkerResponse): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<HashWorkerRequest>) => void
  ): void;
}
const ctx = self as unknown as WorkerScope;

let wasmReady: Promise<unknown> | undefined;
const hashers = new Map<number, Hasher>();

/** Initialize the wasm module exactly once, regardless of concurrent requests. */
function ensureWasm(): Promise<unknown> {
  if (!wasmReady) {
    wasmReady = initWasm();
  }
  return wasmReady;
}

ctx.addEventListener('message', async (event: MessageEvent<HashWorkerRequest>) => {
  const msg = event.data;
  try {
    switch (msg.type) {
      case 'init': {
        await ensureWasm();
        hashers.set(msg.id, new Hasher(msg.algorithm));
        ctx.postMessage({ type: 'ready', id: msg.id });
        break;
      }
      case 'update': {
        const hasher = hashers.get(msg.id);
        if (!hasher) throw new Error(`unknown hasher id ${msg.id}`);
        hasher.update(new Uint8Array(msg.chunk));
        ctx.postMessage({ type: 'updated', id: msg.id });
        break;
      }
      case 'finalize': {
        const hasher = hashers.get(msg.id);
        if (!hasher) throw new Error(`unknown hasher id ${msg.id}`);
        const hex = hasher.finalize();
        // finalize() consumes the wasm instance; just drop our reference.
        hashers.delete(msg.id);
        ctx.postMessage({ type: 'digest', id: msg.id, hex });
        break;
      }
      case 'dispose': {
        const hasher = hashers.get(msg.id);
        // Aborted before finalize — free the still-live wasm allocation.
        hasher?.free();
        hashers.delete(msg.id);
        break;
      }
    }
  } catch (err) {
    ctx.postMessage({
      type: 'error',
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
