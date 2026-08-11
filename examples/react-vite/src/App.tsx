import { UploadzxProvider, type UseUploadzxOptions } from 'uploadzx/react'
import { TusDriver } from 'uploadzx'
import { UploadDashboard } from './components/dashboard/UploadDashboard'

/**
 * Options live at module scope so their identity is stable across renders. The
 * driver is instantiated once here too — never inline in JSX, which would build
 * a new driver (and a new uploader engine) on every render.
 *
 * Avoid a per-progress `onProgress` callback that logs or does work on the main
 * thread: it fires for every active file on every tick. Subscribe to progress in
 * the leaf that renders it instead (see `useUploadProgress(fileId)`).
 */
const uploadOptions: UseUploadzxOptions = {
  driver: new TusDriver({
    endpoint: 'https://tusd.tusdemo.net/files/',
    chunkSize: 1024 * 1024,
  }),
  autoStart: true,
  maxConcurrent: 3,
  trackSpeed: true,
  // Opt into streaming integrity hashing. Each file is hashed once in a Web
  // Worker (Rust → wasm) before upload; the digest is shown per-row and sent to
  // the server as `checksum: "blake3:<hex>"` metadata. The worker + wasm load
  // lazily the first time a file is hashed — see the row's integrity badge.
  integrity: {
    algorithm: 'blake3',
  },
  filePickerOptions: {
    useFileSystemAccess: true,
  },
  onHash: (fileId, digest) => {
    console.info('[uploadzx] hashed (wasm)', fileId, `${digest.algorithm}:${digest.hex}`)
  },
  onComplete: (fileId, url) => {
    console.info('[uploadzx] completed', fileId, url)
  },
  onError: (fileId, error) => {
    console.error('[uploadzx] error', fileId, error)
  },
}

function App() {
  return (
    <UploadzxProvider options={uploadOptions}>
      <UploadDashboard />
    </UploadzxProvider>
  )
}

export default App
