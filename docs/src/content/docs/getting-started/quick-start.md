---
title: Quick start
description: Configure an uploader with a driver, subscribe to events, and upload files.
---

Every uploadzx instance is configured with a **driver** — the transport that
actually moves bytes. The most common is `TusDriver`, which points at a tus
server endpoint. Create the instance, subscribe to events, then pick and upload
files.

## Vanilla TypeScript / JavaScript

```ts
import Uploadzx, { TusDriver } from 'uploadzx';

const uploader = new Uploadzx({
  // The transport. Instantiate it ONCE (not inline on every call).
  driver: new TusDriver({
    endpoint: 'https://your-tus-server.com/files/',
    chunkSize: 1024 * 1024, // 1 MiB
    // Headers may be a value OR an (async) factory, resolved per request —
    // so a long-paused upload resumes with a fresh token.
    headers: async () => ({ Authorization: `Bearer ${await getAccessToken()}` }),
  }),
  maxConcurrent: 3,
  autoStart: true,
  trackSpeed: true,
  // Enforced before a file enters the queue.
  validation: { maxSize: 500 * 1024 * 1024, allowedTypes: ['image/*', 'video/*'] },
  filePickerOptions: { multiple: true, useFileSystemAccess: true },
});

// Multi-listener events — each `on` returns an unsubscribe function.
const off = uploader.on('progress', (p) => console.log(`${p.fileId}: ${p.percentage}%`));
uploader.on('complete', (fileId, url) => console.log('done →', url));
uploader.on('error', (fileId, err) => console.error(err));

// Wait for any prior unfinished uploads to load before driving the queue.
await uploader.ready;

// Open the file picker and start uploading.
await uploader.pickAndUploadFiles();
```

> [!NOTE] Older READMEs show a top-level `endpoint` option on the constructor.
> The current API takes a `driver` instead — wrap your endpoint in
> `new TusDriver({ endpoint })`. This decouples the queue from any single
> protocol (see [Transport drivers](/docs/core/drivers)).

## The classic callback bag

Prefer a single set of callbacks over `on()`? Pass them as the **second**
constructor argument. Both styles can be combined.

```ts
const uploader = new Uploadzx(
  { driver: new TusDriver({ endpoint }), autoStart: true },
  {
    onProgress: (p) => {},
    onStateChange: (state) => {}, // single UploadState argument
    onComplete: (fileId, url) => {},
    onError: (fileId, error) => {},
    onCancel: (fileId) => {},
  }
);
```

## React, in 30 seconds

Wrap your tree in the provider; rows subscribe to their own state granularly.

```tsx
import { UploadzxProvider, useUploadzxActions, useUploadStates, useUploadState } from 'uploadzx/react';
import { TusDriver } from 'uploadzx';

// Define options at module scope so identities stay stable across renders.
const options = { driver: new TusDriver({ endpoint: '/files/' }), autoStart: true };

function App() {
  return (
    <UploadzxProvider options={options}>
      <Uploader />
    </UploadzxProvider>
  );
}

function Uploader() {
  const { pickAndUploadFiles } = useUploadzxActions();
  const { uploadStates } = useUploadStates(); // record of ids
  return (
    <div>
      <button onClick={pickAndUploadFiles}>Upload</button>
      {Object.keys(uploadStates).map((id) => (
        <Row key={id} fileId={id} />
      ))}
    </div>
  );
}

function Row({ fileId }) {
  const state = useUploadState(fileId); // re-renders only when THIS file changes
  if (!state) return null;
  return (
    <div>
      {state.file.name} — {state.status} — {state.progress.percentage}%
    </div>
  );
}
```

Full React details live in the [React section](/docs/react/setup).
