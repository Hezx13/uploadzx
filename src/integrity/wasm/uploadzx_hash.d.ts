/**
 * Stable, hand-written type contract for the wasm-pack output of the
 * `uploadzx-hash` crate (see `crates/uploadzx-hash`). The actual bindings and
 * `.wasm` are generated into the gitignored `pkg/` folder by `pnpm build:wasm`;
 * this declaration is self-contained so the worker type-checks even before the
 * wasm is built. Keep it in sync with `crates/uploadzx-hash/src/lib.rs`.
 */

/** Incremental content hasher backed by WebAssembly. */
export class Hasher {
  /** @param algorithm `"blake3"` or `"sha-256"`. */
  constructor(algorithm: string);
  /** Feed the next slice of the file into the running digest. */
  update(chunk: Uint8Array): void;
  /** Consume the hasher and return the digest as lowercase hex. */
  finalize(): string;
  /** Free the wasm-side allocation (only if not already consumed by finalize). */
  free(): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

/** Initialize the wasm module. Resolves once `Hasher` is usable. */
export default function init(module_or_path?: InitInput | Promise<InitInput>): Promise<unknown>;
