# uploadzx — React + Vite example

A production-shaped dashboard showing how to consume **uploadzx** in React with
**flawless render performance**: hundreds of progress ticks per second update
only the pixels that changed, never the whole tree.

## Run it

```bash
# from the repo root
pnpm install
pnpm build            # build the library (the example consumes its dist)

cd examples/react-vite
pnpm dev              # http://localhost:3000
```

## The performance model (the whole point)

uploadzx exposes its reactive state through an **external store** with
**selector subscriptions** (`useSyncExternalStore` under the hood), not through
context values. The rule that makes everything fast:

> **Subscribe to the narrowest slice you need, as deep in the tree as possible.**

A single context value (`{ actions, store }`) is the only thing in React context,
and its identity never changes — so context never causes a re-render. Everything
dynamic is read via hooks that re-render *only their own component* when *their*
slice changes.

### How this example applies it

| Concern | Hook | Re-renders when… |
| --- | --- | --- |
| The list layout | `useUploadIds()` *(local selector)* | a file is added / removed / cleared |
| Metric count cards | `useUploadCounts()` *(local selector)* | a status transition changes a count |
| Active / queued | `useQueueStats()` | the queue advances |
| One row | `useUploadState(fileId)` | **that file** ticks (siblings untouched) |
| The aggregate % bar | `useQueueAverageProgress()` *(local selector)* | the rounded % changes (~100× total) |
| Actions (buttons) | `useUploadzxActions()` | never (stable identity) |

The result: when file #7 of 50 makes progress, **only row #7 re-renders** — plus
the single isolated progress-bar leaf. The dashboard shell, the list container,
the toolbar, and the other 49 rows do not.

### The two anti-patterns this example avoids

1. **Subscribing wide, passing down.** The naive version calls
   `useUploadStates()` (the whole record) at the top and threads `state` objects
   into every row. That re-renders the entire tree on every tick. Here, parents
   pass **ids only**; each row subscribes to its own state.
2. **A ticking value high in the tree.** Aggregate progress changes continuously,
   so it lives in its own leaf (`QueueProgressBar` inside `MetricsStrip`). Nothing
   above it re-renders when the percentage moves.

### Composing your own selectors

`src/hooks/useUploadSelectors.ts` shows how to build app-specific selectors from
the library's public primitives — `useUploadStore()` + `useStoreSelector()` —
with a custom equality function so equal results never trigger a render:

```ts
export function useUploadIds(): string[] {
  const store = useUploadStore()
  return useStoreSelector(
    store.subscribeStates,
    store.getRecordSnapshot,
    record => Object.keys(record).reverse(),
    shallowArrayEqual, // equal arrays → no re-render
  )
}
```

## API quick reference

```tsx
import { UploadzxProvider } from 'uploadzx/react'
import { TusDriver } from 'uploadzx'

// Options at MODULE scope → stable identity. Driver built once (never inline).
const options = {
  driver: new TusDriver({ endpoint: 'https://tusd.tusdemo.net/files/' }),
  autoStart: true,
  maxConcurrent: 3,
  trackSpeed: true,
}

<UploadzxProvider options={options}>
  <Dashboard />
</UploadzxProvider>
```

Inside the tree:

```tsx
const actions = useUploadzxActions()             // stable; pause/resume/cancel/…
const state = useUploadState(fileId)             // one file, full state
const progress = useUploadProgress(fileId)       // one file, just progress
const status = useUploadStatus(fileId)           // one file, just status
const { queueStats } = useQueueStats()           // active / queued counts
const { unfinishedUploads } = useUnfinishedUploads() // resumable from prior sessions
```

## Code structure

- `src/App.tsx` — provider + stable options/driver
- `src/hooks/useUploadSelectors.ts` — example selectors (`useUploadIds`, `useUploadCounts`, `useQueueAverageProgress`)
- `src/components/dashboard/` — the UI, decomposed so each piece subscribes to the minimum it needs
  - `UploadDashboard.tsx` — shell; subscribes only to infrequently-changing slices
  - `ActivityPanel.tsx` — renders rows from **ids**
  - `UploadItemRow.tsx` — subscribes to its own `fileId`
  - `MetricsStrip.tsx` — count cards + isolated `QueueProgressBar` leaf

## Upload server

Uses the public demo tus server `https://tusd.tusdemo.net/files/`. Swap in your
own tus-compatible endpoint for real use.
