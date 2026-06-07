/**
 * Lightweight, dependency-free logger.
 *
 * A library has no business writing to the consumer's console by default, so
 * every level is a no-op unless `debug` is explicitly enabled. Warnings and
 * errors are still routed through here (rather than bare `console.*`) so a
 * consumer can capture or silence them via a custom logger.
 */
export interface Logger {
  debug(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

const noop = () => {};

/**
 * Creates a logger.
 *
 * @param debug   When `true`, debug/warn/error are written to `console`.
 *                When `false` (default) only `error` is forwarded, since a
 *                swallowed error is worse than a noisy one.
 * @param custom  Optional sink to fully override where logs go.
 */
export function createLogger(debug = false, custom?: Partial<Logger>): Logger {
  if (custom) {
    return {
      debug: custom.debug ?? (debug ? console.debug.bind(console, '[uploadzx]') : noop),
      warn: custom.warn ?? (debug ? console.warn.bind(console, '[uploadzx]') : noop),
      error: custom.error ?? console.error.bind(console, '[uploadzx]'),
    };
  }

  return {
    debug: debug ? console.debug.bind(console, '[uploadzx]') : noop,
    warn: debug ? console.warn.bind(console, '[uploadzx]') : noop,
    error: console.error.bind(console, '[uploadzx]'),
  };
}

/** Shared no-op logger for code paths without an injected one. */
export const silentLogger: Logger = {
  debug: noop,
  warn: noop,
  error: noop,
};
