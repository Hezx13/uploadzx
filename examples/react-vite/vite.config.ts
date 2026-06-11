import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The core bundle lazily does `import('uploadzx/integrity')`, but that bare
      // specifier isn't resolvable from inside the package's own `dist`. Point it
      // at the built integrity entry so Vite can emit its Web Worker (Rust → wasm)
      // and the colocated `.wasm` — this is what makes the hashing run here.
      'uploadzx/integrity': fileURLToPath(new URL('../../dist/integrity/index.js', import.meta.url)),
    },
  },
  optimizeDeps: {
    // Don't pre-bundle the workspace library: its integrity feature spawns a Web
    // Worker via `new URL(..., import.meta.url)`. Leaving it un-prebundled lets
    // Vite's worker/wasm plugins emit those assets correctly.
    exclude: ['uploadzx'],
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
