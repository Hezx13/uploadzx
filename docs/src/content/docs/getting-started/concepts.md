---
title: Core concepts
description: The vocabulary, the upload lifecycle, readiness, and completion eviction.
---

A handful of nouns explain almost everything in the library.

| Concept              | What it is                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Uploadzx`           | The top-level facade. Owns a file picker and an upload queue, exposes events and actions.                    |
| `UploadFile`         | A picked file plus its identity: `{ id, file, name, size, type, fileHandle? }`. The `id` addresses an upload.|
| `UploadQueue`        | Manages many uploads: concurrency cap, ordering, validation, persistence, and event emission. The brain.     |
| `UploadDriver`       | The transport strategy (tus, HTTP PUT, S3…). It knows the protocol; the queue knows everything else.         |
| `UploadController`   | The per-file engine. Drives one driver session through the lifecycle, tracks state/progress/checkpoints.     |
| `PersistenceAdapter` | Where resume bookkeeping is stored. Default is IndexedDB (`FileHandleStore`); swappable.                      |
| `UploadState`        | The observable snapshot of one file: `status`, `progress`, `error?`, `url?`, `file`.                          |

## The upload lifecycle

Every file moves through a small state machine. Illegal transitions are ignored
(e.g. an abort error arriving after an intentional pause is _not_ reported as a
failure).

```text
pending ──▶ uploading ──▶ completed
   ▲           │  │
   │           │  └────────▶ error ──▶ (resume) ──▶ uploading
   │           ▼
   └──────── paused ──▶ (resume) ──▶ uploading

any non-terminal state ──▶ cancelled
```

| Status      | Meaning                                                       |
| ----------- | ------------------------------------------------------------ |
| `pending`   | Queued, not yet started.                                     |
| `uploading` | Actively transferring; emits `progress`.                    |
| `paused`    | Stopped, checkpoint preserved (resumable drivers only).     |
| `completed` | Finished; `url` is populated. (Terminal.)                   |
| `error`     | Failed; can be resumed/retried. `error` is populated.       |
| `cancelled` | Aborted by the user. (Terminal.)                            |

## Readiness: always `await uploader.ready`

On construction, uploadzx asynchronously loads any previously persisted
unfinished uploads and reaps stale records. `ready` is a promise that resolves
once that's done (and rejects if init fails). Await it before relying on
`getUnfinishedUploads()`. In SSR it resolves immediately as an empty queue.

## Completion eviction (memory)

By default (`autoEvictCompleted: true`) the core drops a completed upload's
in-memory bookkeeping the moment it finishes, releasing the retained `File` (and
its blob backing). Completed uploads therefore stop appearing in
`getAllStates()` — observe completion via the `complete` / `stateChange` events
instead. The React store keeps completed rows on screen independently so your UI
can show history. Set the option to `false` to retain completed uploaders in the
core.
