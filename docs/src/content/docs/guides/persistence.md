---
title: Persistence & resume
description: How uploads survive reloads, integrity guards, and custom storage backends.
---

Resumability is the headline feature, and it's powered by two things working
together: the driver's checkpoint and a persistence adapter.

- **The checkpoint** is opaque, driver-defined resume data (for tus, the upload
  URL). The driver emits it via `onCheckpoint` during upload and on pause.
- **The adapter** (default `FileHandleStore`, IndexedDB) stores the file
  reference plus the checkpoint and bytes-uploaded, so an upload can be
  reconstructed later.

## How files are remembered

| Environment                          | What's stored                                                       | Resume behavior                                                                |
| ------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Chrome / Edge (File System Access)   | The `FileSystemFileHandle` (a reference, not the bytes) + checkpoint.| Re-reads the file from disk on resume; may prompt for read permission (needs a user gesture). |
| Safari / Firefox (fallback)          | The file **blob** itself, in a separate IndexedDB store, plus metadata. | Resumes from the cached blob — subject to a storage-quota check on save.     |

## Integrity & hygiene

- **Change detection:** on resume, the file's `lastModified` _and_ `size` must
  match what was stored; otherwise the record is dropped (the file was
  edited/replaced).
- **Content-addressed verification (opt-in):** with
  [integrity hashing](/docs/guides/integrity) enabled, the restored file is
  re-hashed and compared to the persisted digest, catching same-size/same-mtime
  edits the cheap check misses.
- **TTL reaping:** records older than `persistenceTtlMs` (default 7 days) are
  deleted on init, so abandoned uploads don't accumulate. Set `0` to disable.
- **Quota guard:** the Safari blob path refuses to cache a file if it would exceed
  ~95% of the origin's storage quota, surfacing an `error` event for that file
  rather than wedging storage.
- **Throttled writes:** progress is persisted at most ~once/second per file, and
  forced on pause/error.

## Custom persistence adapter

Implement `PersistenceAdapter` and pass it as `store` to use a different backend
(memory, server-synced, etc.).

```ts
interface PersistenceAdapter {
  storeFileHandle(handle: FileSystemFileHandle, id: string): Promise<void>;
  getFileHandle(id: string): Promise<StoredFileHandle | null>;
  getAllFileHandles(): Promise<StoredFileHandle[]>;
  removeFileHandle(id: string): Promise<void>;
  updateFileHandleProgress(id: string, resume: ResumeData | undefined, bytes: number, hash?: IntegrityDigest): Promise<void>;
  getFileFromHandleByID(id: string): Promise<File | null>;
  clear(): Promise<void>;
  reapStale?(maxAgeMs: number): Promise<void>; // optional
}
```
