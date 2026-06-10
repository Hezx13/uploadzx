---
title: Events
description: The event channels, their payloads, and how to subscribe.
---

Subscribe with `on` / `once` (both return an unsubscribe function) or remove with
`off`. Listener errors are isolated — a throwing listener never blocks the others
or stalls the queue.

| Event         | Listener signature              | Fires when                                            |
| ------------- | ------------------------------- | ----------------------------------------------------- |
| `progress`    | `(p: UploadProgress) => void`   | Bytes advance (coalesced ~100&nbsp;ms; final 100% always fires). |
| `stateChange` | `(s: UploadState) => void`      | Any status/progress change for a file.                |
| `complete`    | `(fileId, url) => void`         | A file finishes successfully.                         |
| `error`       | `(fileId, error) => void`       | A file fails, or validation rejects it.              |
| `cancel`      | `(fileId) => void`              | A file transitions to cancelled.                     |

```ts
const off = uploader.on('progress', (p) => {
  render(p.fileId, p.percentage, p.bytesPerSecond);
});
uploader.once('complete', (id, url) => console.log('first done', url));
off(); // unsubscribe the progress listener
```

> [!NOTE] The constructor's second argument (`UploadEvents`) is bridged onto the
> same emitter, so you can mix both styles. The bag's `onStateChange` receives a
> single `UploadState` argument.
