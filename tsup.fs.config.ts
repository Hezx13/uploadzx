import { defineConfig } from 'tsup';

/**
 * Builds optional fs sub-features: thumbnail worker and raw decoder entry.
 * Kept separate so the core fs bundle never pulls in the worker unless used.
 */
export default defineConfig({
  entry: ['src/fs/image/worker/thumb.worker.ts', 'src/fs/raw/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: false,
  outDir: 'dist/fs',
  target: 'es2020',
  platform: 'browser',
  treeshake: true,
  bundle: true,
});
