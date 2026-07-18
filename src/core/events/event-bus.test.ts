import { describe, expect, it, vi } from 'vitest';

import { createEventBus } from './event-bus';

interface TestMap {
  ping: { readonly n: number };
  pong: { readonly s: string };
}

describe('event bus', () => {
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
