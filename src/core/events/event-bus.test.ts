import { describe, expect, it, vi } from 'vitest';

import { createEventBus } from './event-bus';

interface TestMap {
  ping: { readonly n: number };
  pong: { readonly s: string };
}

describe('event bus — core behavior', () => {
  it('delivers typed payloads to subscribers', () => {
    const bus = createEventBus<TestMap>();
    const handler = vi.fn();
    bus.on('ping', handler);
    bus.emit('ping', { n: 1 });
    expect(handler).toHaveBeenCalledWith({ n: 1 });
  });

  it('does not deliver to handlers of other events', () => {
    const bus = createEventBus<TestMap>();
    const handler = vi.fn();
    bus.on('pong', handler);
    bus.emit('ping', { n: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribe stops delivery', () => {
    const bus = createEventBus<TestMap>();
    const handler = vi.fn();
    const off = bus.on('ping', handler);
    off();
    bus.emit('ping', { n: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('once fires exactly once', () => {
    const bus = createEventBus<TestMap>();
    const handler = vi.fn();
    bus.once('ping', handler);
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('listenerCount reflects active subscriptions', () => {
    const bus = createEventBus<TestMap>();
    const off = bus.on('ping', vi.fn());
    expect(bus.listenerCount('ping')).toBe(1);
    off();
    expect(bus.listenerCount('ping')).toBe(0);
  });

  it('allows a handler to unsubscribe during dispatch', () => {
    const bus = createEventBus<TestMap>();
    const calls: number[] = [];
    const offA = bus.on('ping', () => {
      calls.push(1);
      offA();
    });
    bus.on('ping', () => {
      calls.push(2);
    });
    bus.emit('ping', { n: 0 });
    bus.emit('ping', { n: 0 });
    expect(calls).toEqual([1, 2, 2]);
  });

  it('clear removes all listeners', () => {
    const bus = createEventBus<TestMap>();
    bus.on('ping', vi.fn());
    bus.clear();
    expect(bus.listenerCount('ping')).toBe(0);
  });
});

describe('event bus — production features', () => {
  it('dispatches by descending priority, then subscription order', () => {
    const bus = createEventBus<TestMap>();
    const order: string[] = [];
    bus.on('ping', () => order.push('a-low'), { priority: 0 });
    bus.on('ping', () => order.push('b-high'), { priority: 10 });
    bus.on('ping', () => order.push('c-low'), { priority: 0 });
    bus.emit('ping', { n: 1 });
    expect(order).toEqual(['b-high', 'a-low', 'c-low']);
  });

  it('once can be expressed via options', () => {
    const bus = createEventBus<TestMap>();
    const handler = vi.fn();
    bus.on('ping', handler, { once: true });
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('onAny observes every event as a tick-tagged envelope', () => {
    let tick = 0;
    const bus = createEventBus<TestMap>({ tickProvider: () => tick });
    const seen: { name: string; tick: number }[] = [];
    bus.onAny((envelope) => seen.push({ name: String(envelope.name), tick: envelope.tick }));
    tick = 4;
    bus.emit('ping', { n: 1 });
    tick = 5;
    bus.emit('pong', { s: 'x' });
    expect(seen).toEqual([
      { name: 'ping', tick: 4 },
      { name: 'pong', tick: 5 },
    ]);
  });

  it('tracks emit and delivery statistics', () => {
    const bus = createEventBus<TestMap>();
    bus.on('ping', vi.fn());
    bus.on('ping', vi.fn());
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    const stats = bus.stats();
    expect(stats.emitted).toBe(2);
    expect(stats.delivered).toBe(4);
    expect(stats.perEvent['ping']).toBe(2);
  });

  it('freezes payloads when configured', () => {
    const bus = createEventBus<TestMap>({ freezePayloads: true });
    bus.on('ping', vi.fn());
    const payload = { n: 1 };
    bus.emit('ping', payload);
    expect(Object.isFrozen(payload)).toBe(true);
  });

  it('reports listener leaks past a threshold', () => {
    const onLeak = vi.fn();
    const bus = createEventBus<TestMap>({ leakThreshold: 2, onLeak });
    bus.on('ping', vi.fn());
    bus.on('ping', vi.fn());
    bus.on('ping', vi.fn());
    expect(onLeak).toHaveBeenCalledWith('ping', 3);
  });

  it('runs a payload validator before dispatch', () => {
    const bus = createEventBus<TestMap>({
      validate: (event, payload) => {
        if (event === 'ping' && (payload as { n: number }).n < 0) {
          throw new Error('n must be non-negative');
        }
      },
    });
    bus.on('ping', vi.fn());
    expect(() => bus.emit('ping', { n: -1 })).toThrow('n must be non-negative');
  });
});
