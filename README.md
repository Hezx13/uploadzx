# uploadzx

> ⚠️ **Development Notice**: This library is currently in active development. The stable release is planned for not earlier than **July 15, 2025**. Use with caution in production environments.

[![npm version](https://img.shields.io/npm/v/uploadzx.svg)](https://www.npmjs.com/package/uploadzx)
[![npm downloads](https://img.shields.io/npm/dm/uploadzx.svg)](https://www.npmjs.com/package/uploadzx)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A browser-only TypeScript library for **resumable uploads** and **native filesystem access**. It provides a developer-friendly abstraction over tus-js-client for uploads, plus a decoupled `uploadzx/fs` module for picking, persisting, watching, and exporting files — with optional image metadata, thumbnails, and RAW decoding.

Both modules are **UI-agnostic**: they emit state and expose actions; you bring your own interface (or use the React bindings).

## Package entry points

| Import | Purpose |
| ------ | ------- |
| `uploadzx` | Core upload queue, file picker, tus/HTTP drivers |
| `uploadzx/react` | React hooks and components for uploads + filesystem |
| `uploadzx/fs` | Filesystem access (pick, persist, watch, export, image helpers) |
| `uploadzx/fs/raw` | Optional RAW decoder (wasm injectable, lazy-loaded) |
| `uploadzx/integrity` | Optional streaming BLAKE3/SHA-256 hashing (wasm, lazy-loaded) |

---

## Features at a glance

### Upload (`uploadzx`)

- Resumable uploads via tus protocol (or custom drivers)
- Concurrency-capped queue with pause, resume, and cancel
- Progress tracking with optional upload speed
- Persistent upload state in IndexedDB (TTL reaping + quota guards)
- File System Access API support with Safari/Firefox fallbacks
- Pluggable transport (`TusDriver`, `HttpPutDriver`, custom) and storage adapters
- Multi-listener events (`on`/`off`/`once`) plus a classic callback bag
- Dynamic auth — headers/metadata resolved per request
- Built-in validation (size, MIME type, file count)
- SSR-safe construction (no IndexedDB until the browser runs)

### Filesystem (`uploadzx/fs`)

- Native file and **directory** picking with recursive import
- Gesture-aware permission handling (query-first, no nag on denied)
- IndexedDB persistence for handles + metadata (migration-ready schema)
- Storage-efficient: handles on Chrome/Edge; size-capped byte cache on Safari/Firefox
- LRU-capped thumbnail cache with separate byte budget
- Save / export via `showSaveFilePicker` and save-in-place via `createWritable`
- Live file watching (`FileSystemObserver` + polling fallback)
- Image metadata (EXIF/IPTC/XMP) via lazy-loaded `exifr`
- Thumbnail generation in a Web Worker (main-thread fallback)
- Optional RAW decoding behind `uploadzx/fs/raw`

### Cross-cutting

- React integration with granular per-file subscriptions (no list-wide re-renders)
- Opt-in integrity hashing in a Web Worker (Rust → wasm) for checksums and dedup
- Full TypeScript types throughout

---

## Installation

```bash
npm install uploadzx
# or
pnpm add uploadzx
# or
yarn add uploadzx
```

Optional: `exifr` is used for image metadata when you call `readMetadata()`. It is listed as an optional dependency and loaded only when needed.

---

## Quick start — Uploads

```typescript
import Uploadzx, { TusDriver } from 'uploadzx';

const uploader = new Uploadzx({
  driver: new TusDriver({
    endpoint: 'https://your-tus-endpoint.com/files/',
    chunkSize: 1024 * 1024,
    headers: async () => ({ Authorization: `Bearer ${await getAccessToken()}` }),
  }),
  maxConcurrent: 3,
  autoStart: true,
  validation: { maxSize: 500 * 1024 * 1024, allowedTypes: ['image/*', 'video/*'] },
  filePickerOptions: { multiple: true, useFileSystemAccess: true },
});

uploader.on('progress', (p) => console.log(`${p.fileId}: ${p.percentage}%`));
uploader.on('complete', (fileId, url) => console.log(`Completed: ${url}`));
uploader.on('error', (fileId, err) => console.error(err));

await uploader.ready;
await uploader.pickAndUploadFiles();
```

> **Note:** Pass a `driver` (e.g. `new TusDriver({ endpoint })`), not a bare `endpoint` on the constructor. This keeps the queue protocol-agnostic.

---

## Quick start — Filesystem

```typescript
import { FileSystemManager } from 'uploadzx/fs';

const fs = new FileSystemManager({
  filePicker: { accept: 'image/*', useFileSystemAccess: true },
});

await fs.ready;

// Pick files (pass withinGesture=true when called from a click handler)
const entries = await fs.pickFiles(true);

// Or import an entire folder
const { entries: folder } = await fs.pickDirectory(true);

// Read metadata and generate a thumbnail
const meta = await fs.readMetadata(entries[0].id, true);
const thumb = await fs.getThumbnail(entries[0].id, true);

// After a page reload, reconnect with one gesture
if (fs.pendingPermissions().length) {
  await fs.reconnect(true);
}
```

---

## Feature reference

### 1. Resumable uploads

Uploadzx wraps [tus-js-client](https://github.com/tus/tus-js-client) in a queue that manages concurrency, state, and persistence.

**What you get**

- Files survive tab closes: resume data and file handles are stored in IndexedDB
- Pause/resume per file or the whole queue
- Cancel in-flight uploads via `AbortController`
- Automatic eviction of completed uploads (configurable) to release memory

**Key APIs**

```typescript
await uploader.pauseUpload(fileId);
await uploader.resumeUpload(fileId);
await uploader.cancelUpload(fileId);
await uploader.getUnfinishedUploads();
await uploader.restoreUnfinishedUpload(fileId);
```

**Persistence behaviour**

| Browser | Stored | Resume behaviour |
| ------- | ------ | ---------------- |
| Chrome / Edge | `FileSystemFileHandle` + checkpoint | Re-reads file from disk; may prompt for permission |
| Safari / Firefox | File blob in IndexedDB + checkpoint | Resumes from cached blob (quota-guarded) |

Records older than `persistenceTtlMs` (default 7 days) are reaped on init. Set `0` to disable.

---

### 2. Upload queue & transport drivers

The queue owns validation, concurrency, events, and persistence. The **driver** owns the wire protocol.

**Built-in drivers**

```typescript
import { TusDriver, HttpPutDriver } from 'uploadzx';

// tus — resumable, chunked
new TusDriver({ endpoint: '/files/', chunkSize: 8 * 1024 * 1024 });

// Simple PUT/POST — non-resumable
new HttpPutDriver({ url: 'https://api.example.com/upload', method: 'PUT' });
```

**Custom driver**

Implement `UploadDriver` and pass a factory via `uploaderFactory` on `UploadQueue` (or use the queue directly). The queue handles progress, checkpoints, and state transitions; your driver only speaks the protocol.

**Queue options**

```typescript
interface QueueOptions {
  driver: UploadDriver;
  maxConcurrent?: number;        // default 3
  autoStart?: boolean;
  validation?: FileValidationOptions;
  store?: PersistenceAdapter;   // swap IndexedDB for memory/server
  persistenceTtlMs?: number;
  trackSpeed?: boolean;
  autoEvictCompleted?: boolean; // default true
  integrity?: IntegrityOptions; // see below
}
```

---

### 3. File picking (upload core)

`FilePicker` supports two paths:

- **File System Access API** (`showOpenFilePicker`) — returns persistent `FileSystemFileHandle`s on Chrome/Edge
- **`<input type="file">`** — universal fallback; no cross-session handle persistence

```typescript
const files = await uploader.pickFiles();
// or configure via filePickerOptions on construction:
// { accept: 'image/*', multiple: true, useFileSystemAccess: true }
```

Drag-and-drop helpers live in the core utils:

```typescript
import { getFilesFromDragEvent } from 'uploadzx';

dropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  const items = await getFilesFromDragEvent(e);
  await uploader.addFiles(items.map(({ file, handle }) => ({
    id: crypto.randomUUID(),
    file,
    fileHandle: handle,
    name: file.name,
    size: file.size,
    type: file.type,
  })));
});
```

---

### 4. Filesystem module (`uploadzx/fs`)

A standalone module for apps that need native-feeling file access without uploads — photo libraries, editors, import/export flows.

#### FileSystemManager

The main facade wires picking, storage, permissions, watching, and image helpers:

```typescript
import { FileSystemManager } from 'uploadzx/fs';

const fs = new FileSystemManager({
  filePicker: { accept: 'image/*', useFileSystemAccess: true },
  maxCachedFileBytes: 50 * 1024 * 1024,   // Safari byte-cache cap
  thumbCacheBudgetBytes: 100 * 1024 * 1024,
  watchPollIntervalMs: 5000,
  debug: false,
});
```

| Method | Description |
| ------ | ----------- |
| `pickFiles(withinGesture)` | Open file picker, persist entries |
| `pickDirectory(withinGesture)` | Import folder (recursive on native picker) |
| `pickFromDrag(event, withinGesture)` | Handle drag-and-drop imports |
| `list(parentId?)` | List persisted entries |
| `readFile(id, withinGesture)` | Get `File` for an entry |
| `readMetadata(id, withinGesture)` | EXIF/IPTC/XMP + dimensions |
| `getThumbnail(id, withinGesture)` | LRU-cached WebP/JPEG thumbnail |
| `saveAs(blob, opts)` | Export via save picker (download fallback) |
| `saveInPlace(handle, blob, withinGesture)` | Overwrite via `createWritable` |
| `reconnect(withinGesture)` | Re-request permissions after reload |
| `watchDirectory(dirHandle)` | Start live change notifications |
| `decodeRaw(id, withinGesture)` | Decode RAW via configured decoder |

**Events**

```typescript
fs.on('add', (entry) => {});
fs.on('change', (entry) => {});
fs.on('remove', (id) => {});
fs.on('permissionchange', (pendingHandles) => {});
fs.on('error', (err) => {});
```

#### Permissions

`PermissionManager` is designed to feel native and avoid permission fatigue:

1. **Query always** — safe to call outside a user gesture
2. **Request only in a gesture** — pass `withinGesture: true` from click handlers
3. **Remember denied** — won't re-prompt for the session
4. **Directory grant covers children** — one folder pick unlocks many files
5. **Single `permissionchange` event** — drive one "Reconnect your photos" banner

```typescript
fs.on('permissionchange', (pending) => {
  if (pending.length) showReconnectBanner();
});

reconnectBtn.onclick = () => fs.reconnect(true);
```

#### Storage & migrations

`FsStore` uses a versioned IndexedDB schema with an ordered migration runner (`DB_VERSION`). Records carry a `schemaVersion` for lazy per-record reshaping without full DB bumps.

Separate object stores:

- `records` — metadata (name, path, size, type, parentId, …)
- `handles` — `FileSystemFileHandle` references (Chrome/Edge only)
- `cached-bytes` — Safari/Firefox blob cache (size-capped)
- `thumbs` + `thumb-meta` — LRU-evicted thumbnail cache

Swap the backend by implementing `StorageAdapter`.

#### Directory import

```typescript
import { DirectoryPicker, walkDirectory } from 'uploadzx/fs';

const picker = new DirectoryPicker();
const { dirHandle, entries, usedFallback } = await picker.pickDirectory({
  accept: 'image/*',
  maxDepth: 10,
  startIn: 'pictures',
});
```

On browsers without `showDirectoryPicker`, falls back to `<input webkitdirectory>`.

#### Save & export

```typescript
import { Saver } from 'uploadzx/fs';

const saver = new Saver();
const handle = await saver.saveAs(blob, {
  suggestedName: 'export.jpg',
  types: [{ description: 'JPEG', accept: { 'image/jpeg': ['.jpg'] } }],
});
await saver.saveInPlace(existingHandle, editedBlob);
```

#### File watching

`FileWatcher` uses `FileSystemObserver` when available; otherwise polls `lastModified` + `size` (optional content-hash verification via `uploadzx/integrity`).

```typescript
import { FileWatcher } from 'uploadzx/fs';

const watcher = new FileWatcher(fs.store, { pollIntervalMs: 5000 });
watcher.on('change', (entry) => refreshPreview(entry));
await watcher.watchDirectory(dirHandle);
```

#### Image metadata

Lazy-loaded `exifr` behind a `MetadataReader` interface — nothing is bundled until you call `readMetadata()`:

```typescript
import { createMetadataReader } from 'uploadzx/fs';

const reader = createMetadataReader();
const meta = await reader.read(file);
// meta.dimensions, meta.exif, meta.iptc, meta.xmp, meta.isRaw
```

#### Thumbnails

Generated in a Web Worker (`OffscreenCanvas` → WebP) with a main-thread canvas fallback. Results are written to the LRU thumb store:

```typescript
import { createThumbnailer, ThumbnailCache } from 'uploadzx/fs';

const cache = new ThumbnailCache(fs.store, createThumbnailer());
const thumb = await cache.getOrCreate(recordId, file, { maxSize: 256 });
```

Build the worker bundle separately: `pnpm build:fs`.

#### RAW decoding

Kept out of the core bundle. Provide a wasm loader or use the stub for development:

```typescript
import { createRawDecoder, createStubRawDecoder } from 'uploadzx/fs/raw';

fs.setRawDecoder(createStubRawDecoder()); // dev/test
// or
fs.setRawDecoder(createRawDecoder({ wasmLoader: () => loadYourLibRawWasm() }));

const pixels = await fs.decodeRaw(entryId, true);
// { width, height, data: Uint8Array (RGBA), colorSpace }
```

---

### 5. Integrity & checksums (`uploadzx/integrity`)

Opt-in streaming BLAKE3 or SHA-256 hashing in a Web Worker (Rust → wasm). Loaded lazily — zero cost when disabled.

```typescript
import Uploadzx, { TusDriver } from 'uploadzx';

const uploader = new Uploadzx({
  driver: new TusDriver({ endpoint: '/files/' }),
  integrity: {
    algorithm: 'blake3', // or 'sha-256'
    verifyResume: true,    // re-hash on resume, drop on mismatch
    sendToServer: true,    // tus metadata checksum
    dedup: true,           // skip duplicate digests this session
  },
});

uploader.on('hash', (fileId, digest) => {
  console.log(`${digest.algorithm}:${digest.hex}`);
});
```

Build: `pnpm build:integrity` (requires Rust + wasm-pack).

---

### 6. Validation

Enforced before a file enters the queue (upload) or can be used standalone:

```typescript
import { validateFile } from 'uploadzx';

const err = validateFile(file, {
  maxSize: 100 * 1024 * 1024,
  allowedTypes: ['image/*', 'application/pdf'],
});
if (err) console.warn(err);
```

Wildcard MIME subtypes (`image/*`) are supported. The File System Access picker maps `image/*` to concrete MIME types for native filtering.

---

### 7. React integration (`uploadzx/react`)

#### Upload hooks

Use focused hooks so each row re-renders only when **its own** file changes:

```tsx
import {
  UploadzxProvider,
  useUploadzxActions,
  useUploadStates,
  useUploadState,
} from 'uploadzx/react';

function App() {
  return (
    <UploadzxProvider
      options={{
        driver: new TusDriver({ endpoint: 'https://your-server.com/files/' }),
        maxConcurrent: 3,
        autoStart: true,
      }}
    >
      <UploadUI />
    </UploadzxProvider>
  );
}

function UploadUI() {
  const { pickAndUploadFiles } = useUploadzxActions();
  const { uploadStates } = useUploadStates();
  return (
    <>
      <button onClick={pickAndUploadFiles}>Upload</button>
      {Object.keys(uploadStates).map((id) => (
        <UploadRow key={id} fileId={id} />
      ))}
    </>
  );
}

function UploadRow({ fileId }: { fileId: string }) {
  const state = useUploadState(fileId);
  if (!state) return null;
  return <div>{state.file.name} — {state.progress.percentage}%</div>;
}
```

| Hook | Purpose |
| ---- | ------- |
| `useUploadzxActions()` | Pick, add, pause, resume, cancel |
| `useUploadStates()` | All upload states |
| `useUploadState(fileId)` | Per-file state (preferred for rows) |
| `useUploadItem(fileId)` | State + per-file actions |
| `useQueueActions()` | Queue-level pause/resume/cancel + stats |
| `useUnfinishedUploads()` | Resumable uploads from storage |
| `useFilePicker(options)` | Standalone file picker |
| `useUploadStore()` | Raw external store (advanced) |

#### Filesystem hooks

```tsx
import { useFileSystemManager, useFsPermissions, useFsEntries } from 'uploadzx/react';

function PhotoLibrary() {
  const { pickDirectory, reconnect, manager } = useFileSystemManager({
    filePicker: { accept: 'image/*', useFileSystemAccess: true },
  });
  const { pending, hasPending } = useFsPermissions(manager);
  const entries = useFsEntries(manager);

  return (
    <>
      <button onClick={() => pickDirectory(true)}>Import folder</button>
      {hasPending && (
        <button onClick={() => reconnect(true)}>Reconnect ({pending.length})</button>
      )}
      <ul>{entries.map((e) => <li key={e.id}>{e.name}</li>)}</ul>
    </>
  );
}
```

#### Components

- `UploadzxProvider` — context for upload queue
- `UploadDropzone` — drag-and-drop upload zone

---

## Browser support

| Capability | Chrome / Edge | Firefox | Safari |
| ---------- | ------------- | ------- | ------ |
| tus uploads | ✅ | ✅ | ✅ |
| File picker (input) | ✅ | ✅ | ✅ |
| File System Access (handles) | ✅ | ❌ | ❌ |
| Directory picker | ✅ | `webkitdirectory` fallback | `webkitdirectory` fallback |
| Save picker | ✅ | download fallback | download fallback |
| IndexedDB persistence | ✅ | ✅ | ✅ |
| `FileSystemObserver` | ✅ | polling fallback | polling fallback |
| Integrity wasm hasher | ✅ | ✅ | ✅ |

---

## Examples

```bash
# Install dependencies and build
pnpm examples:install

# React + Vite demo
pnpm example:react

# Vanilla TS + Vite demo
pnpm example:vanilla
```

---

## Development

```bash
pnpm install

# Core library (upload + fs entry)
pnpm build

# Optional subpath bundles
pnpm build:integrity   # wasm hasher → dist/integrity (needs Rust + wasm-pack)
pnpm build:fs          # thumbnail worker + raw entry → dist/fs

# Everything (prepublish)
pnpm build:all

pnpm dev               # watch mode
pnpm test              # Vitest + fake-indexeddb
pnpm test:wasm         # Rust crate unit tests
```

### Project layout

```
src/
├── index.ts              # Uploadzx facade
├── core/                 # FilePicker, UploadQueue, FileHandleStore
├── transport/            # TusDriver, HttpPutDriver, UploadController
├── fs/                   # uploadzx/fs — filesystem module
│   ├── FileSystemManager.ts
│   ├── access/           # pick, directory, save
│   ├── permissions/
│   ├── store/            # FsStore + migrations
│   ├── watch/
│   ├── image/            # metadata, thumbnails, worker
│   └── raw/              # uploadzx/fs/raw
├── integrity/            # uploadzx/integrity — wasm hasher
└── react/                # uploadzx/react — hooks & components
```

Full documentation: see the `docs/` site or [guides on GitHub](https://github.com/Hezx13/uploadzx).

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [uploadzx](https://github.com/Hezx13/uploadzx)
