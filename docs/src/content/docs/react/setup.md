---
title: Setup & Provider
description: Mount UploadzxProvider and understand why it keeps large lists fast.
---

`uploadzx/react` wraps the core in a context provider plus a set of focused hooks
built on `useSyncExternalStore`. The headline benefit: a row only re-renders when
**its own** file changes — a 200-file list doesn't repaint because file&nbsp;#3
ticked forward.

## UploadzxProvider

Mount it once near the top of the tree. It creates and owns a single core
instance + an external store for the lifetime of the provider.

```tsx
import { UploadzxProvider, type UseUploadzxOptions } from 'uploadzx/react';
import { TusDriver } from 'uploadzx';

// CRITICAL: define options (and the driver) at module scope. Inlining them in
// JSX builds a new driver — and a new upload engine — on every render.
const options: UseUploadzxOptions = {
  driver: new TusDriver({ endpoint: '/files/', chunkSize: 1024 * 1024 }),
  autoStart: true,
  maxConcurrent: 3,
  trackSpeed: true,
  onComplete: (id, url) => console.info('done', url),
};

function App() {
  return (
    <UploadzxProvider options={options}>
      <YourUI />
    </UploadzxProvider>
  );
}
```

`UseUploadzxOptions` = `UploadzxOptions` plus optional per-instance callbacks:
`onProgress`, `onStateChange`, `onComplete`, `onError`, `onCancel`, and `onInit`.

> [!WARNING] Don't use a per-render `onProgress` for heavy work. It fires for
> every active file on every tick. Render progress in the leaf that shows it via
> `useUploadProgress(fileId)` instead.
