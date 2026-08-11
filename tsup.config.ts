import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm', 'iife'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    globalName: 'Uploadzx',
    outDir: 'dist',
    target: 'es2020',
    minify: false,
  external: ['uploadzx/integrity', 'uploadzx/fs/raw'],
    noExternal: ['tus-js-client'],
    treeshake: true,
    bundle: true,
    platform: 'browser',
    esbuildOptions(options) {
      options.define = {
        ...options.define,
        global: 'globalThis',
      };
    },
  },
  {
    entry: ['src/fs/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    outDir: 'dist/fs',
    target: 'es2020',
    minify: false,
    external: ['uploadzx/fs/raw', 'exifr'],
    treeshake: true,
    bundle: true,
    platform: 'browser',
  },
  {
    entry: ['src/react/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    outDir: 'dist/react',
    target: 'es2020',
    minify: false,
    // Keep the worker-backed wasm hasher lazy here too — without this the
    // `import('uploadzx/integrity')` in the core gets inlined into the React
    // bundle, pulling the worker + wasm into every React consumer.
    external: ['react', 'uploadzx/integrity', 'uploadzx/fs/raw', 'exifr'],
    treeshake: true,
    bundle: true,
    platform: 'browser',
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
  },
]); 