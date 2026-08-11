import { defineConfig } from 'tsup';

/**
 * Builds the optional integrity-hashing feature as a self-contained ESM bundle
 * under `dist/integrity/`: the public entry, the hashing Web Worker, and the
 * wasm it loads. Kept separate from the core build so the core bundle never
 * pulls in the worker or wasm, and so this step can require the Rust/wasm
 * toolchain (run `pnpm build:wasm` first) without affecting `pnpm build`.
 */
export default defineConfig({
  entry: ['src/integrity/index.ts', 'src/integrity/worker/hash.worker.ts'],
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: false,
  outDir: 'dist/integrity',
  target: 'es2020',
  platform: 'browser',
  treeshake: true,
  bundle: true,
  // Copy the `.wasm` next to the worker and rewrite the `new URL(...)` reference.
  loader: { '.wasm': 'copy' },
});
