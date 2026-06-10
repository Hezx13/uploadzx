---
title: Performance model
description: Why the React bindings keep large lists fast.
---

The bindings are designed to keep large lists fast. The key ideas:

- **Stable context value.** The provider's context is just `{ actions, store }`,
  both with fixed identities — so context never triggers a re-render.
- **External store, not context, for dynamic data.** Per-file state, stats, and
  the unfinished list live in an `UploadStore`; components subscribe to the exact
  slice they need via `useSyncExternalStore`.
- **Two-level memoized selectors.** `useUploadSelector` short-circuits on snapshot
  identity, then on selected-value equality, so selecting `status` won't
  re-render on a progress tick.
- **Events are the single source of truth.** The store is updated by the core's
  emitter, so derived values (e.g. stats after a completion frees a queue slot)
  can't drift.

> [!TIP] **Rule of thumb:** render the _list of ids_ with `useUploadStates()`, and
> inside each row use `useUploadItem(fileId)` (or `useUploadStatus` +
> `useUploadProgress`). Avoid reading the full states record inside rows.
