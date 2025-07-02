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
    external: [],
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
    entry: ['src/react/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    outDir: 'dist/react',
    target: 'es2020',
    minify: false,
    external: ['react'],
    treeshake: true,
    bundle: true,
    platform: 'browser',
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
  },
]); 