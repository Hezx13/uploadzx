/**
 * Minimal typed event emitter with multi-listener support.
 *
 * multiple consumers (a React
 * hook, analytics, a logger) can subscribe independently and unsubscribe
 * without clobbering one another.
 */
export type EventMap = Record<string, (...args: any[]) => void>;

export class TypedEmitter<Events extends EventMap> {
  private listeners: { [K in keyof Events]?: Set<Events[K]> } = {};

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof Events>(event: K, listener: Events[K]): () => void {
    let set = this.listeners[event];
    if (!set) {
      set = new Set();
      this.listeners[event] = set;
    }
    set.add(listener);
    return () => this.off(event, listener);
  }

  /** Subscribe to a single occurrence of an event. */
  once<K extends keyof Events>(event: K, listener: Events[K]): () => void {
    const wrapped = ((...args: Parameters<Events[K]>) => {
      this.off(event, wrapped as Events[K]);
      listener(...args);
    }) as Events[K];
    return this.on(event, wrapped);
  }

  /** Remove a previously registered listener. */
  off<K extends keyof Events>(event: K, listener: Events[K]): void {
    const set = this.listeners[event];
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) {
      delete this.listeners[event];
    }
  }

  /** Emit an event to all listeners. A throwing listener never blocks the rest. */
  emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    const set = this.listeners[event];
    if (!set) return;
    // Copy so a listener that unsubscribes during dispatch doesn't mutate the set.
    for (const listener of Array.from(set)) {
      try {
        listener(...args);
      } catch {
        // Listener errors are isolated; the queue continues operating.
      }
    }
  }

  /** Remove all listeners (optionally for a single event). */
  removeAll<K extends keyof Events>(event?: K): void {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }
}
