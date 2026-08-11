---
title: Filesystem access
description: Native-feeling file and directory access, permissions, persistence, image metadata, thumbnails, and optional RAW decoding via uploadzx/fs.
---

**uploadzx/fs** is a decoupled module for browser filesystem work — independent of
uploads. Use it when you need to pick photos, import folders, persist file
handles across sessions, export edits, read EXIF, generate thumbnails, or decode
RAW files.

The upload queue is untouched; you can adopt `uploadzx/fs` on its own or combine
it with the core upload library later.

## Installation

The module ships with the main package:

```bash
pnpm add uploadzx
```

Optional metadata parsing uses `exifr` (installed automatically as an optional
dependency when available):

```ts
import { FileSystemManager } from 'uploadzx/fs';
```

## Quick start

```ts
import { FileSystemManager } from 'uploadzx/fs';

const fs = new FileSystemManager({
  filePicker: { accept: 'image/*', useFileSystemAccess: true },
});

await fs.ready;

// Pick files (requires user gesture for permission prompts)
const entries = await fs.pickFiles(true);
console.log(entries.map(e => e.name));

// Reconnect after reload — one gesture restores access
const pending = fs.pendingPermissions();
if (pending.length) {
  await fs.reconnect(true);
}
```

## Core concepts

| Concept | What it is |
| ------- | ---------- |
| `FileSystemManager` | Facade wiring picker, store, permissions, watcher, and image helpers |
| `FsStore` | IndexedDB persistence for handles + metadata (not upload-shaped) |
| `PermissionManager` | Gesture-aware permission flow; never nags on denied |
| `DirectoryPicker` | `showDirectoryPicker` with `webkitdirectory` fallback |
| `Saver` | `showSaveFilePicker` + `createWritable` save-in-place |
| `FileWatcher` | `FileSystemObserver` with polling fallback |

## Permissions

The permission layer always **queries first** and only **requests inside a user
gesture**. Denied handles are remembered for the session. When access is lost,
subscribe once and show a single reconnect affordance:

```ts
fs.on('permissionchange', pending => {
  if (pending.length) showReconnectBanner();
});

button.onclick = () => fs.reconnect(true);
```

Prefer granting a **directory handle** — child files inherit access without
extra prompts.

## Persistence & storage

- **Chrome / Edge:** stores `FileSystemFileHandle` references only (no bytes).
- **Safari / Firefox:** caches file blobs in a separate store, size-capped per file.
- **Thumbnails:** separate LRU-capped store with a configurable byte budget.
- **Migrations:** ordered runner with `DB_VERSION`; per-record `schemaVersion`
  for lazy reshaping without full DB bumps.

```ts
const fs = new FileSystemManager({
  maxCachedFileBytes: 50 * 1024 * 1024,
  thumbCacheBudgetBytes: 100 * 1024 * 1024,
});
```

## Directory import

```ts
const { dirHandle, entries } = await fs.pickDirectory(true);
// entries includes nested files when native directory picker is used
```

## Export & save

```ts
const blob = await renderEditedImage();
await fs.saveAs(blob, { suggestedName: 'edited.jpg' });

// Save over an existing handle (requires readwrite permission)
await fs.saveInPlace(fileHandle, blob, true);
```

## Image metadata & thumbnails

```ts
const meta = await fs.readMetadata(entryId, true);
console.log(meta?.dimensions, meta?.exif);

const thumb = await fs.getThumbnail(entryId, true);
const url = URL.createObjectURL(thumb!);
```

Metadata uses lazy-loaded `exifr`. Thumbnails run in a Web Worker when
`OffscreenCanvas` is available, with a main-thread fallback.

## RAW decoding

RAW support lives behind `uploadzx/fs/raw` and does not ship wasm in the core
bundle. Provide a wasm loader or use the stub for development:

```ts
import { createRawDecoder, createStubRawDecoder } from 'uploadzx/fs/raw';

fs.setRawDecoder(createStubRawDecoder());
const pixels = await fs.decodeRaw(entryId, true);
```

For production, inject a wasm-backed `RawDecoder` via `wasmLoader`.

## React hooks

```ts
import { useFileSystemManager, useFsPermissions } from 'uploadzx/react';

function Library() {
  const { pickDirectory, reconnect, manager } = useFileSystemManager();
  const { pending, hasPending } = useFsPermissions(manager);

  return (
    <>
      <button onClick={() => pickDirectory(true)}>Import folder</button>
      {hasPending && <button onClick={() => reconnect(true)}>Reconnect</button>}
    </>
  );
}
```

## Browser support

| Feature | Chrome / Edge | Safari / Firefox |
| ------- | ------------- | ---------------- |
| Native file picker + handles | Yes | Fallback (`<input>`) |
| Directory picker | Yes | `webkitdirectory` fallback |
| Persist handles across reload | Yes | Blob cache (size-capped) |
| Save / export picker | Yes | Download fallback |
| `FileSystemObserver` | Chrome 86+ | Polling fallback |
