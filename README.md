# uploadzx

> ⚠️ **Development Notice**: This library is currently in active development. The stable release is planned for not earlier than **July 15, 2025**. Use with caution in production environments.

[![npm version](https://img.shields.io/npm/v/uploadzx.svg)](https://www.npmjs.com/package/uploadzx)
[![npm downloads](https://img.shields.io/npm/dm/uploadzx.svg)](https://www.npmjs.com/package/uploadzx)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A browser-only TypeScript upload library that provides a developer-friendly abstraction over tus-js-client for resumable file uploads with React integration.

## Features

- 🚀 **Resumable uploads** using tus protocol
- 📱 **Cross-browser compatibility** including Safari fallback
- ⚡ **File System Access API** support for modern browsers
- 🎯 **React integration** with granular, per-file subscriptions (no list-wide re-renders)
- 📊 **Progress tracking** with detailed upload statistics
- ⏸️ **Pause, resume, and cancel** with a concurrency-capped queue
- 💾 **Persistent upload state** using IndexedDB (with TTL reaping + quota guards)
- 🔌 **Pluggable transport & storage** — swap tus for S3/presigned via interfaces
- 🔔 **Multi-listener events** (`on`/`off`/`once`) plus the classic callback bag
- 🔑 **Dynamic auth** — headers/metadata can be async functions, refreshed per request
- ✅ **Built-in validation** — size / type / count enforced before upload
- 🖥️ **SSR-safe** — construct on the server without touching IndexedDB
- 🎨 **UI-agnostic design** - bring your own UI or use our React components

## Installation

```bash
npm install uploadzx
# or
pnpm add uploadzx
# or
yarn add uploadzx
```

## Quick Start

### Vanilla JavaScript/TypeScript

```typescript
import Uploadzx from 'uploadzx';

const uploader = new Uploadzx({
  endpoint: 'https://your-tus-endpoint.com/files',
  maxConcurrent: 3,
  autoStart: true,
  // Headers/metadata may be a value OR an (async) function, resolved per
  // request — so a long-paused upload resumes with a fresh token.
  headers: async () => ({ Authorization: `Bearer ${await getAccessToken()}` }),
  // Enforced before a file enters the queue.
  validation: { maxSize: 500 * 1024 * 1024, allowedTypes: ['image/*', 'video/*'] },
  filePickerOptions: {
    multiple: true,
    useFileSystemAccess: true,
  },
});

// Multi-listener events (each `on` returns an unsubscribe function):
const off = uploader.on('progress', (p) => console.log(`${p.fileId}: ${p.percentage}%`));
uploader.on('complete', (fileId, tusUrl) => console.log(`Completed: ${tusUrl}`));
uploader.on('error', (fileId, err) => console.error(`Error for ${fileId}:`, err));

// Wait for any prior unfinished uploads to load before driving the queue.
await uploader.ready;

// Pick files and start uploading
await uploader.pickAndUploadFiles();
```

> The classic single-callback bag still works too — pass `{ onProgress, onComplete, onError, onStateChange, onCancel }` as the second constructor argument. Note `onStateChange` receives a single `UploadState` argument.

### React Integration

Use the focused hooks so a row only re-renders when **its own** file changes:

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
        endpoint: 'https://your-upload-server.com/upload',
        chunkSize: 1024 * 1024,
        autoStart: true,
      }}
    >
      <UploadComponent />
    </UploadzxProvider>
  );
}

function UploadComponent() {
  const { pickAndUploadFiles } = useUploadzxActions();
  // The record of ids; rows subscribe to their own state individually.
  const { uploadStates } = useUploadStates();

  return (
    <div>
      <button onClick={pickAndUploadFiles}>Upload Files</button>
      {Object.keys(uploadStates).map((fileId) => (
        <UploadRow key={fileId} fileId={fileId} />
      ))}
    </div>
  );
}

function UploadRow({ fileId }: { fileId: string }) {
  // Granular subscription — re-renders only when THIS file changes.
  const state = useUploadState(fileId);
  if (!state) return null;
  return (
    <div>
      {state.file.name} - {state.status} - {state.progress.percentage}%
    </div>
  );
}
```

## React Hooks

- `useUploadzxActions()` - Queue actions (pick, add, pause, resume, cancel, ...)
- `useUploadStates()` - Live record of all upload states
- `useUploadState(fileId)` - Granular per-file subscription (preferred for rows)
- `useUploadItem(fileId)` - Per-item state + pause/resume/cancel handlers
- `useQueueActions()` - Queue-level actions and stats
- `useUnfinishedUploads()` - Resumable uploads recovered from storage
- `useFilePicker(options)` - File picking functionality
- `useUploadStore()` - Access the raw external store (advanced)

> `useUploadzxContext()` still exists but is **deprecated** — prefer the focused hooks above.

## React Components

- `UploadzxProvider` - Context provider for upload functionality
- `UploadDropzone` - Drag and drop upload component

## API Reference

### Core Options

```typescript
interface UploadzxOptions {
  endpoint: string;
  chunkSize?: number;
  maxConcurrent?: number;
  autoStart?: boolean;
  retryDelays?: number[];
  // Static value OR an (async) factory resolved per request.
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
  metadata?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
  // Enforced before a file enters the queue.
  validation?: { maxSize?: number; allowedTypes?: string[]; maxFiles?: number };
  // Max age (ms) of persisted records before they're reaped on init. Default 7 days; 0 disables.
  persistenceTtlMs?: number;
  // Pluggable backends.
  uploaderFactory?: UploaderFactory;     // swap tus for S3/presigned/...
  store?: PersistenceAdapter;            // swap IndexedDB for a custom store
  // Diagnostics (off by default — the library does not log otherwise).
  debug?: boolean;
  logger?: Partial<{ debug: Function; warn: Function; error: Function }>;
  filePickerOptions?: {
    multiple?: boolean;
    useFileSystemAccess?: boolean;
    accept?: string;
  };
}
```

### Events

Subscribe with `on` / `once` (each returns an unsubscribe function) or `off`:

```typescript
const off = uploader.on('progress', (p: UploadProgress) => {});
uploader.on('stateChange', (s: UploadState) => {});
uploader.on('complete', (fileId: string, tusUrl: string) => {});
uploader.on('error', (fileId: string, error: Error) => {});
uploader.on('cancel', (fileId: string) => {});
off(); // unsubscribe
```

The legacy callback bag passed to the constructor is also supported:

```typescript
interface UploadEvents {
  onProgress?: (progress: UploadProgress) => void;
  onStateChange?: (state: UploadState) => void; // single argument
  onComplete?: (fileId: string, tusUrl: string) => void;
  onError?: (fileId: string, error: Error) => void;
  onCancel?: (fileId: string) => void;
}
```

### Readiness

`Uploadzx` loads any previously persisted unfinished uploads asynchronously. Await `uploader.ready` (resolves on success, rejects on init failure) before relying on `getUnfinishedUploads()`.

### Custom transport

Implement the `Uploader` interface and pass an `uploaderFactory` to upload anywhere (S3 multipart, a presigned `PUT`, etc.) while keeping the queue, persistence, progress, and React layers unchanged.

## Browser Support

- **Chrome/Edge**: Full support with File System Access API
- **Firefox**: Full support with fallback file picker
- **Safari**: Full support with Safari-specific optimizations
- **Mobile browsers**: Supported with appropriate fallbacks

## Examples

The project includes comprehensive examples:

```bash
# Install all dependencies and build library
pnpm examples:install

# Run React + Vite example
pnpm example:react

# Run Vanilla JS + Vite example
pnpm example:vanilla
```

## Development

```bash
# Install dependencies
pnpm install

# Build the library
pnpm build

# Watch for changes
pnpm dev

# Run the test suite (Vitest + fake-indexeddb)
pnpm test

# Run examples
pnpm example:react
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [uploadzx](https://github.com/Hezx13/uploadzx) 
