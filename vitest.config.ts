import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // The queue lazily imports the worker-backed hasher from this subpath.
      // Tests inject their own hasher and never spawn the worker, but Vite still
      // resolves the literal dynamic-import specifier at transform time.
      'uploadzx/integrity': fileURLToPath(new URL('./src/integrity/index.ts', import.meta.url)),
      'uploadzx/fs': fileURLToPath(new URL('./src/fs/index.ts', import.meta.url)),
      'uploadzx/fs/raw': fileURLToPath(new URL('./src/fs/raw/index.ts', import.meta.url)),
      exifr: fileURLToPath(new URL('./test/stubs/exifr.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
    globals: true,
  },
});
