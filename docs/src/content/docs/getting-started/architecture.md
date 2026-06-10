---
title: Architecture
description: How the layers fit together and the invariants that keep them decoupled.
---

uploadzx is layered so each piece has one job and depends only on interfaces
below it. That's what makes transports and storage swappable, and lets the React
layer stay a thin shell over the framework-agnostic core.

```text
┌──────────────────────────────────────────────────────────────┐
│  React layer  (uploadzx/react)                                 │
│  UploadzxProvider · useUploadzx · UploadStore                  │
│  granular hooks: useUploadState / useUploadProgress / …        │
└───────────────▲──────────────────────────────────────────────┘
                │  events (single source of truth)
┌───────────────┴──────────────────────────────────────────────┐
│  Uploadzx (facade)            FilePicker                       │
│     │                          (input / File System Access)    │
│     ▼                                                          │
│  UploadQueue  ── concurrency cap · validation · event emitter  │
│     │                                                          │
│     ├── UploadController (one per file)                        │
│     │      ├── UploadStateMachine   (status transitions)       │
│     │      ├── ProgressTracker      (bytes, %, speed)          │
│     │      └── CheckpointStore      (resume data)              │
│     │              │ createSession()                           │
│     │              ▼                                           │
│     │        UploadDriver  ── TusDriver · HttpPutDriver · …    │
│     │                                                          │
│     └── PersistenceAdapter ── FileHandleStore (IndexedDB)      │
└──────────────────────────────────────────────────────────────┘
```

## Invariants

- **Events are the single source of truth.** The queue's emitter drives every
  derived value (the React store, queue stats), so nothing can go stale the way a
  "sync after each action" approach can.
- **The controller doesn't implement protocol details.** It coordinates a driver
  session and delegates state, progress math, and resume bookkeeping to small
  collaborators.
- **Progress is coalesced.** The controller throttles outward `progress` emission
  (~100&nbsp;ms) so a chatty transport can't flood listeners or React renders —
  the final 100% tick always fires.
- **Persistence writes are throttled too** (~1&nbsp;s per file) and forced on
  pause/error so an interruption is always recoverable.

These invariants are what let you add a [custom driver](/docs/core/custom-driver)
or a [persistence adapter](/docs/guides/persistence) without touching the queue,
progress, or React layers.
