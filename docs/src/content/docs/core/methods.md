---
title: Instance methods
description: Everything you can call on an Uploadzx instance.
---

All methods on an `Uploadzx` instance. File-scoped methods take the `id` from an
`UploadFile`.

## Properties

| Member               | Description                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `ready: Promise<void>` | Resolves when prior unfinished uploads are loaded; rejects on init failure. Always await first.  |

## Picking & adding files

| Method                       | Description                                                              |
| ---------------------------- | ----------------------------------------------------------------------- |
| `pickAndUploadFiles()`       | Open the picker and add the chosen files to the queue.                   |
| `pickFiles()`                | Open the picker and return the chosen `UploadFile[]` without queuing.    |
| `addFiles(files)`            | Add already-constructed files (e.g. from drag & drop). Returns accepted. |
| `startUploads()`             | Start processing the queue.                                             |

## Control

| Method                                          | Description                                                  |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `pauseUpload(id)` · `resumeUpload(id)` · `cancelUpload(id)` | Control a single file.                          |
| `pauseAll()` · `resumeAll()` · `cancelAll()`    | Control the whole queue. `cancelAll()` also clears persisted records. |
| `restoreUnfinishedUpload(handleOrId)`           | Re-create an uploader for a persisted unfinished upload so it can resume. |
| `clearCompletedUploads()`                       | Drop completed/cancelled uploaders from memory.            |

## Querying

| Method                    | Returns                                                            |
| ------------------------- | ----------------------------------------------------------------- |
| `getUploadState(id)`      | `UploadState \| null`                                             |
| `getAllStates()`          | `UploadState[]` (excludes auto-evicted completed uploads)         |
| `getQueueStats()`         | `{ queueLength, activeCount }`                                    |
| `getUnfinishedUploads()`  | `Promise<StoredFileHandle[]>` — resumable uploads from storage   |
| `getIsInitialized()`      | `boolean`                                                         |

## Events & lifecycle

| Method                  | Description                                                          |
| ----------------------- | ------------------------------------------------------------------ |
| `on(event, listener)`   | Subscribe. Returns an unsubscribe function.                        |
| `once(event, listener)` | Subscribe for a single occurrence. Returns an unsubscribe function.|
| `off(event, listener)`  | Remove a listener.                                                 |
| `destroy()`             | Detach all listeners (e.g. on teardown). Does _not_ cancel transfers.|

## Drag & drop example

Build `UploadFile`s yourself, then call `addFiles()`.

```ts
dropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer?.files ?? []).map((file) => ({
    id: crypto.randomUUID(),
    file,
    name: file.name,
    size: file.size,
    type: file.type,
  }));
  await uploader.addFiles(files);
});
```
