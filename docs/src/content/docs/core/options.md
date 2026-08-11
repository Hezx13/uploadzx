---
title: Configuration options
description: Every option accepted by the Uploadzx constructor and the file picker.
---

The `Uploadzx` constructor takes `UploadzxOptions` (which extends `QueueOptions`)
and an optional events bag. Only `driver` is required.

```ts
interface UploadzxOptions extends QueueOptions {
  filePickerOptions?: FilePickerOptions;
}

new Uploadzx(options: UploadzxOptions, events?: UploadEvents);
```

## Options

| Option               | Type                          | Default            | Description                                                                                  |
| -------------------- | ----------------------------- | ------------------ | -------------------------------------------------------------------------------------------- |
| `driver`             | `UploadDriver`                | —                  | **Required.** Transport strategy: `new TusDriver({…})`, `new HttpPutDriver({…})`, or your own.|
| `maxConcurrent`      | `number`                      | `3`                | Maximum simultaneous active uploads.                                                          |
| `autoStart`          | `boolean`                     | `false`            | Start uploads as soon as files are added (and auto-resume restored uploads).                  |
| `validation`         | `FileValidationOptions`       | —                  | `{ maxSize?, allowedTypes?, maxFiles? }` — enforced before a file enters the queue.           |
| `trackSpeed`         | `boolean`                     | `false`            | Compute `bytesPerSecond` in progress events.                                                  |
| `persistenceTtlMs`   | `number`                      | `604800000` (7d)   | Max age of persisted records before they're reaped on init. `0` disables reaping.            |
| `autoEvictCompleted` | `boolean`                     | `true`             | Drop a completed upload's in-memory state to release its `File`. See [concepts](/docs/getting-started/concepts). |
| `store`              | `PersistenceAdapter`          | IndexedDB          | Swap the persistence backend (e.g. an in-memory store for tests).                            |
| `integrity`          | `IntegrityOptions`            | —                  | Opt-in streaming hashing (BLAKE3/SHA-256) for resume verification, checksum metadata, and dedup. See [Integrity](/docs/guides/integrity). |
| `debug`              | `boolean`                     | `false`            | Enable verbose internal logging. Off by default — the library is silent otherwise.           |
| `logger`             | `Partial<Logger>`             | console            | Custom sink: `{ debug, warn, error }`. Overrides the default console logger.                  |
| `onInit`             | `() => void`                  | —                  | Called once the queue is initialized and ready. (Prefer `await ready`.)                       |
| `filePickerOptions`  | `FilePickerOptions`           | —                  | Picker behavior — see below.                                                                  |

## filePickerOptions

| Option                | Type      | Default | Description                                                                                              |
| --------------------- | --------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `multiple`            | `boolean` | `true`  | Allow selecting more than one file.                                                                      |
| `useFileSystemAccess` | `boolean` | `false` | Use `showOpenFilePicker` when available so handles can be persisted for cross-session resume; falls back to `<input>` elsewhere. |
| `accept`              | `string`  | —       | HTML-style accept string, e.g. `"image/*,.pdf"`.                                                         |

> [!NOTE] Driver options like `endpoint`, `chunkSize`, `retryDelays`, `headers`,
> and `metadata` are configured on the **driver**, not the top-level options. See
> [Transport drivers](/docs/core/drivers).
