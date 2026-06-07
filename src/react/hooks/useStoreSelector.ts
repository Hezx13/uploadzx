import { useCallback, useRef, useSyncExternalStore } from 'react';

/**
 * Selector layer over `useSyncExternalStore`. Subscribes to a store section and
 * returns `selector(snapshot)`, re-rendering only when the *selected* value
 * changes according to `isEqual` (default `Object.is`).
 *
 * Two-level memo: first short-circuit on snapshot identity, then on selection
 * equality. This keeps a stable reference for the returned value so React does
 * not re-render when, say, a file's progress ticks but the consumer only
 * selected its `status`.
 *
 * No external dependency: hand-rolled rather than pulling in
 * `use-sync-external-store/with-selector`, keeping React a pure peer dep.
 */
export function useStoreSelector<S, T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => S,
  selector: (snapshot: S) => T,
  isEqual: (a: T, b: T) => boolean = Object.is
): T {
  const memo = useRef<{ snapshot: S; value: T } | null>(null);

  const getSelection = useCallback(() => {
    const snapshot = getSnapshot();
    const cache = memo.current;

    // Snapshot unchanged → selection cannot have changed.
    if (cache && Object.is(cache.snapshot, snapshot)) {
      return cache.value;
    }

    const value = selector(snapshot);

    // Snapshot changed but the selected slice is equal → keep the stable ref so
    // useSyncExternalStore does not schedule a re-render.
    if (cache && isEqual(cache.value, value)) {
      memo.current = { snapshot, value: cache.value };
      return cache.value;
    }

    memo.current = { snapshot, value };
    return value;
  }, [getSnapshot, selector, isEqual]);

  return useSyncExternalStore(subscribe, getSelection, getSelection);
}
