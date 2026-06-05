import { describe, it, expect, vi } from 'vitest';
import { TypedEmitter } from '../src/utils';

type Events = {
  ping: (n: number) => void;
  done: () => void;
  [key: string]: (...args: any[]) => void;
};

describe('TypedEmitter', () => {
  it('delivers to multiple independent listeners', () => {
    const e = new TypedEmitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    e.on('ping', a);
    e.on('ping', b);
    e.emit('ping', 7);
    expect(a).toHaveBeenCalledWith(7);
    expect(b).toHaveBeenCalledWith(7);
  });

  it('unsubscribes via returned disposer and via off()', () => {
    const e = new TypedEmitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    const off = e.on('ping', a);
    e.on('ping', b);
    off();
    e.off('ping', b);
    e.emit('ping', 1);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('once() fires exactly once', () => {
    const e = new TypedEmitter<Events>();
    const a = vi.fn();
    e.once('ping', a);
    e.emit('ping', 1);
    e.emit('ping', 2);
    expect(a).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith(1);
  });

  it('isolates a throwing listener from the rest', () => {
    const e = new TypedEmitter<Events>();
    const boom = vi.fn(() => {
      throw new Error('boom');
    });
    const ok = vi.fn();
    e.on('ping', boom as any);
    e.on('ping', ok);
    expect(() => e.emit('ping', 1)).not.toThrow();
    expect(ok).toHaveBeenCalledWith(1);
  });

  it('tolerates a listener that unsubscribes during dispatch', () => {
    const e = new TypedEmitter<Events>();
    const seen: string[] = [];
    const off2 = () => {};
    const l1 = () => {
      seen.push('l1');
      e.off('done', l2);
    };
    const l2 = () => seen.push('l2');
    e.on('done', l1);
    e.on('done', l2);
    expect(() => e.emit('done')).not.toThrow();
    expect(seen).toContain('l1');
  });
});
