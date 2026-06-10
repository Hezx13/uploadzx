import { useStoreSelector, useUploadStore } from 'uploadzx/react'

/**
 * Example-local selector hooks.
 *
 * These show the core performance pattern for consuming uploadzx in React:
 * subscribe to the *narrowest* derived slice you need, with a custom equality
 * function, so a component only re-renders when that slice actually changes —
 * never on raw progress ticks.
 *
 * They are built entirely from the library's public primitives
 * (`useUploadStore` + `useStoreSelector`), so you can drop them into your own app
 * or adapt them. The selector still runs on every store change, but returning a
 * referentially-equal value short-circuits the re-render — renders, not
 * recomputations, are what cost you.
 */

function shallowArrayEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Ordered list of upload ids, newest first. Re-renders ONLY when the set of ids
 * changes (a file is added, cleared, or cancelled) — not when a file makes
 * progress. This is what keeps the list container still while individual rows,
 * which subscribe to their own id, update independently.
 */
export function useUploadIds(): string[] {
  const store = useUploadStore()
  return useStoreSelector(
    store.subscribeStates,
    store.getRecordSnapshot,
    record => Object.keys(record).reverse(),
    shallowArrayEqual
  )
}

export interface UploadCounts {
  total: number
  completed: number
  failed: number
  uploading: number
  paused: number
}

function countsEqual(a: UploadCounts, b: UploadCounts): boolean {
  return (
    a.total === b.total &&
    a.completed === b.completed &&
    a.failed === b.failed &&
    a.uploading === b.uploading &&
    a.paused === b.paused
  )
}

/**
 * Aggregate status counts. Re-renders only on a status *transition* (e.g. a file
 * finishes), not on progress ticks, thanks to `countsEqual`. Drives the metric
 * cards and the "can clear / can cancel" affordances.
 */
export function useUploadCounts(): UploadCounts {
  const store = useUploadStore()
  return useStoreSelector(
    store.subscribeStates,
    store.getRecordSnapshot,
    record => {
      const counts: UploadCounts = { total: 0, completed: 0, failed: 0, uploading: 0, paused: 0 }
      for (const id in record) {
        counts.total += 1
        switch (record[id].status) {
          case 'completed':
            counts.completed += 1
            break
          case 'error':
            counts.failed += 1
            break
          case 'uploading':
            counts.uploading += 1
            break
          case 'paused':
            counts.paused += 1
            break
        }
      }
      return counts
    },
    countsEqual
  )
}

/**
 * Rounded aggregate progress across all uploads. This one DOES update with
 * progress — it has to, it's a live aggregate — but rounding to an integer means
 * it re-renders at most ~100 times total, not once per byte. Keep it in the
 * smallest possible leaf (the progress bar) so nothing else re-renders with it.
 */
export function useQueueAverageProgress(): number {
  const store = useUploadStore()
  return useStoreSelector(store.subscribeStates, store.getRecordSnapshot, record => {
    const ids = Object.keys(record)
    if (ids.length === 0) return 0
    let total = 0
    for (const id of ids) {
      const upload = record[id]
      total += upload.status === 'completed' ? 100 : (upload.progress?.percentage ?? 0)
    }
    return Math.round(total / ids.length)
  })
}
