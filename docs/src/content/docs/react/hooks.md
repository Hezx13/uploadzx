---
title: Hooks reference
description: Every hook, what it returns, and when it re-renders.
---

All hooks must be used inside `UploadzxProvider`. Pick the narrowest hook for the
job to minimize re-renders.

## Actions & queue-level state

| Hook                   | Returns                                                                                                                                                                | Re-renders?                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `useUploadzxActions()` | Stable actions: `pickAndUploadFiles`, `pickFiles`, `addFiles`, `startUploads`, `pause/resume/cancelAll`, `pause/resume/cancelUpload(id)`, `getUploadState`, `getAllStates`, `clearCompletedUploads`, `restoreUnfinishedUpload`. | **Never** — stable identities. |
| `useQueueStats()`      | `{ queueStats: { queueLength, activeCount } }`                                                                                                                        | Only when stats change.    |
| `useQueueActions()`    | Wrapper: `handlePause/Resume/CancelAll`, `handlePickFiles`, flags (`hasActiveUploads`, `hasQueuedUploads`), `queueStatsText`.                                          | On stats changes.          |
| `useUnfinishedUploads()` | `{ unfinishedUploads: StoredFileHandle[] }` — recoverable uploads from storage.                                                                                     | When the list changes.     |
| `useUploadzxState()`   | `{ isInitialized: boolean }`                                                                                                                                          | Once, on init.             |

## Per-file (granular)

| Hook                                       | Returns                                                                                | Re-renders when…                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `useUploadState(fileId)`                   | `UploadState \| null`                                                                  | that file changes (incl. every progress tick).    |
| `useUploadProgress(fileId)`                | `UploadProgress \| null`                                                               | that file's progress changes.                     |
| `useUploadStatus(fileId)`                  | `UploadStatus \| null`                                                                 | that file's status changes (skips progress ticks).|
| `useUploadSelector(fileId, selector, isEqual?)` | `T`                                                                               | the _selected slice_ changes (default `Object.is`).|
| `useUploadItem(fileId)`                    | `{ status, progress, handlePause/Resume/Cancel, canPause, canResume, canCancel }`      | status or progress changes.                       |

## List & low-level

| Hook                  | Returns / use                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `useUploadStates()`   | `{ uploadStates: Record<string, UploadState> }`. Re-renders on every tick of every file — use it only to render the list of ids.    |
| `useFilePicker(opts)` | `{ pickFiles }` — a standalone picker, independent of the provider.                                                                |
| `useUploadStore()`    | The raw external store (advanced). Prefer the selector hooks above.                                                                |
| `useUploadzx(opts)`   | The underlying hook the provider uses. Returns `{ store, actions }`. For building a custom provider.                               |
| `useUploadzxContext()`| **Deprecated.** Returns everything at once; re-renders on every tick. Prefer the focused hooks.                                    |

## A complete list + row example

```tsx
import { useUploadzxActions, useUploadStates, useUploadItem, useQueueActions } from 'uploadzx/react';

function Toolbar() {
  const { handlePauseAll, handleResumeAll, handleCancelAll, queueStatsText } = useQueueActions();
  const { pickAndUploadFiles } = useUploadzxActions();
  return (
    <div>
      <button onClick={pickAndUploadFiles}>Add files</button>
      <button onClick={handlePauseAll}>Pause all</button>
      <button onClick={handleResumeAll}>Resume all</button>
      <button onClick={handleCancelAll}>Cancel all</button>
      <span>{queueStatsText}</span>
    </div>
  );
}

function List() {
  const { uploadStates } = useUploadStates(); // ids only
  return <>{Object.keys(uploadStates).map((id) => <Row key={id} fileId={id} />)}</>;
}

function Row({ fileId }: { fileId: string }) {
  const { status, progress, handlePause, handleResume, handleCancel, canPause, canResume, canCancel } =
    useUploadItem(fileId);
  return (
    <div>
      <progress value={progress?.percentage ?? 0} max={100} />
      <span>{status}</span>
      {canPause && <button onClick={handlePause}>Pause</button>}
      {canResume && <button onClick={handleResume}>Resume</button>}
      {canCancel && <button onClick={handleCancel}>Cancel</button>}
    </div>
  );
}
```
