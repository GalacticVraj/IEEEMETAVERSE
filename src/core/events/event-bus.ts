/**
 * Strongly-typed, synchronous publish/subscribe bus — the ONLY channel through
 * which the simulation communicates with consumers (rendering, audio, UI,
 * state, replay, analytics). Consumers never poll simulation internals.
 *
 * Production-grade features: priority ordering, once listeners, wildcard
 * tracing (`onAny`, the seam replay records through), emit/delivery statistics,
 * optional payload freezing (immutability), payload validation, listener-leak
 * detection, and profiling hooks. Wall-clock access (tick/time) is INJECTED via
 * providers so this module stays pure and framework-free.
 */

export type EventHandler<TPayload> = (payload: TPayload) => void;

/** Returned by `on`/`once`; call it to remove the subscription. */
export type Unsubscribe = () => void;

export interface ListenerOptions {
  /** Higher priority handlers run first within an event. Default 0. */
  readonly priority?: number;
  /** Remove the handler automatically after its first invocation. */
  readonly once?: boolean;
}

/** A traced event, delivered to `onAny` subscribers and used by replay. */
export interface EventEnvelope<TName extends PropertyKey = PropertyKey, TPayload = unknown> {
  readonly name: TName;
  readonly payload: TPayload;
  readonly tick: number;
  readonly timestamp: number;
  /** Monotonic emit sequence number (deterministic ordering key). */
  readonly seq: number;
}

export type AnyEventHandler<TEventMap> = (
  envelope: EventEnvelope<keyof TEventMap, TEventMap[keyof TEventMap]>,
) => void;

export interface EventBusStats {
  readonly emitted: number;
  readonly delivered: number;
  readonly perEvent: Readonly<Record<string, number>>;
}

export interface EventBusOptions<TEventMap> {
  /** Supplies the current simulation tick for envelope tagging. */
  readonly tickProvider?: () => number;
  /** Supplies a monotonic time (ms) for timestamps/profiling. */
  readonly timeProvider?: () => number;
  /** Freeze payloads before dispatch to enforce immutability. */
  readonly freezePayloads?: boolean;
  /** Warn when an event's listener count exceeds this. */
  readonly leakThreshold?: number;
  readonly onLeak?: (event: keyof TEventMap, count: number) => void;
  /** Validate a payload before dispatch; throw to reject. */
  readonly validate?: <TName extends keyof TEventMap>(
    event: TName,
    payload: TEventMap[TName],
  ) => void;
  /** Profiling hook invoked after each emit. */
  readonly onProfile?: (event: keyof TEventMap, durationMs: number, listeners: number) => void;
}

export interface TypedEventBus<TEventMap> {
  on<TName extends keyof TEventMap>(
    event: TName,
    handler: EventHandler<TEventMap[TName]>,
    options?: ListenerOptions,
  ): Unsubscribe;
  once<TName extends keyof TEventMap>(
    event: TName,
    handler: EventHandler<TEventMap[TName]>,
  ): Unsubscribe;
  off<TName extends keyof TEventMap>(event: TName, handler: EventHandler<TEventMap[TName]>): void;
  emit<TName extends keyof TEventMap>(event: TName, payload: TEventMap[TName]): void;
  /** Subscribe to EVERY event as a traced envelope (debug/replay). */
  onAny(handler: AnyEventHandler<TEventMap>): Unsubscribe;
  clear(): void;
  listenerCount<TName extends keyof TEventMap>(event: TName): number;
  totalListenerCount(): number;
  stats(): EventBusStats;
  resetStats(): void;
}

interface Listener {
  readonly handler: EventHandler<unknown>;
  readonly priority: number;
  readonly seq: number;
  readonly once: boolean;
}

/**
 * Create an in-memory typed event bus. Dispatch is synchronous and ordered by
 * (priority desc, subscription order). The listener list is snapshotted per
 * emit so a handler may safely subscribe/unsubscribe during dispatch.
 */
export function createEventBus<TEventMap>(
  options: EventBusOptions<TEventMap> = {},
): TypedEventBus<TEventMap> {
  const registry = new Map<keyof TEventMap, Listener[]>();
  const anyListeners = new Set<AnyEventHandler<TEventMap>>();
  const perEvent = new Map<string, number>();

  let seqCounter = 0;
  let emitSeq = 0;
  let emitted = 0;
  let delivered = 0;

  const now = (): number => options.timeProvider?.() ?? 0;
  const currentTick = (): number => options.tickProvider?.() ?? 0;

  const erase = <TName extends keyof TEventMap>(
    handler: EventHandler<TEventMap[TName]>,
  ): EventHandler<unknown> => handler as unknown as EventHandler<unknown>;

  const remove = <TName extends keyof TEventMap>(
    event: TName,
    handler: EventHandler<unknown>,
  ): void => {
    const listeners = registry.get(event);
    if (listeners === undefined) return;
    const filtered = listeners.filter((listener) => listener.handler !== handler);
    if (filtered.length === 0) {
      registry.delete(event);
    } else {
      registry.set(event, filtered);
    }
  };

  const add = <TName extends keyof TEventMap>(
    event: TName,
    handler: EventHandler<TEventMap[TName]>,
    priority: number,
    once: boolean,
  ): Unsubscribe => {
    const erased = erase(handler);
    const listener: Listener = { handler: erased, priority, seq: seqCounter, once };
    seqCounter += 1;
    const listeners = registry.get(event) ?? [];
    listeners.push(listener);
    listeners.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
    registry.set(event, listeners);

    if (options.leakThreshold !== undefined && listeners.length > options.leakThreshold) {
      options.onLeak?.(event, listeners.length);
    }
    return () => {
      remove(event, erased);
    };
  };

  const on: TypedEventBus<TEventMap>['on'] = (event, handler, listenerOptions) =>
    add(event, handler, listenerOptions?.priority ?? 0, listenerOptions?.once ?? false);

  const once: TypedEventBus<TEventMap>['once'] = (event, handler) => add(event, handler, 0, true);

  const off: TypedEventBus<TEventMap>['off'] = (event, handler) => {
    remove(event, erase(handler));
  };

  const emit: TypedEventBus<TEventMap>['emit'] = (event, payload) => {
    options.validate?.(event, payload);
    if (options.freezePayloads && typeof payload === 'object' && payload !== null) {
      Object.freeze(payload);
    }

    emitted += 1;
    const key = String(event);
    perEvent.set(key, (perEvent.get(key) ?? 0) + 1);

    if (anyListeners.size > 0) {
      const envelope: EventEnvelope<keyof TEventMap, TEventMap[keyof TEventMap]> = {
        name: event,
        payload,
        tick: currentTick(),
        timestamp: now(),
        seq: emitSeq,
      };
      emitSeq += 1;
      for (const anyHandler of [...anyListeners]) {
        anyHandler(envelope);
      }
    } else {
      emitSeq += 1;
    }

    const listeners = registry.get(event);
    if (listeners === undefined) return;

    const started = options.onProfile ? now() : 0;
    const snapshot = [...listeners];
    for (const listener of snapshot) {
      (listener.handler as EventHandler<typeof payload>)(payload);
      delivered += 1;
      if (listener.once) {
        remove(event, listener.handler);
      }
    }
    options.onProfile?.(event, now() - started, snapshot.length);
  };

  return {
    on,
    once,
    off,
    emit,
    onAny(handler: AnyEventHandler<TEventMap>): Unsubscribe {
      anyListeners.add(handler);
      return () => {
        anyListeners.delete(handler);
      };
    },
    clear(): void {
      registry.clear();
      anyListeners.clear();
    },
    listenerCount: (event) => registry.get(event)?.length ?? 0,
    totalListenerCount(): number {
      let total = 0;
      for (const listeners of registry.values()) {
        total += listeners.length;
      }
      return total;
    },
    stats(): EventBusStats {
      return { emitted, delivered, perEvent: Object.fromEntries(perEvent) };
    },
    resetStats(): void {
      emitted = 0;
      delivered = 0;
      emitSeq = 0;
      perEvent.clear();
    },
  };
}
