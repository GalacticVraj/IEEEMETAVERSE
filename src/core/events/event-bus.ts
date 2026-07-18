/**
 * Strongly-typed, synchronous publish/subscribe bus — the ONLY channel through
 * which the simulation communicates with consumers (rendering, audio, UI,
 * state, replay, analytics). Consumers never poll simulation internals.
 *
 * The bus is generic over an event map (name → payload type). `emit`/`on`/
 * `once`/`off` infer the payload from the event name, so a wrong payload shape
 * is a compile error and there are no untyped event strings.
 */

export type EventHandler<TPayload> = (payload: TPayload) => void;

/** Returned by `on`/`once`; call it to remove the subscription. */
export type Unsubscribe = () => void;

export interface TypedEventBus<TEventMap> {
  /** Subscribe to `event`. Returns an unsubscribe function. */
  on<TName extends keyof TEventMap>(
    event: TName,
    handler: EventHandler<TEventMap[TName]>,
  ): Unsubscribe;

  /** Subscribe for a single dispatch, then auto-unsubscribe. */
  once<TName extends keyof TEventMap>(
    event: TName,
    handler: EventHandler<TEventMap[TName]>,
  ): Unsubscribe;

  /** Remove a specific handler for `event`. */
  off<TName extends keyof TEventMap>(event: TName, handler: EventHandler<TEventMap[TName]>): void;

  /** Synchronously dispatch `payload` to all handlers of `event`. */
  emit<TName extends keyof TEventMap>(event: TName, payload: TEventMap[TName]): void;

  /** Remove every subscription (used on shutdown/reset). */
  clear(): void;

  /** Number of active handlers for `event` (debug/introspection). */
  listenerCount<TName extends keyof TEventMap>(event: TName): number;
}

/**
 * Create an in-memory typed event bus. Dispatch is synchronous and ordered;
 * the handler set is snapshotted per emit so a handler may safely subscribe or
 * unsubscribe during dispatch without affecting the current fan-out.
 */
export function createEventBus<TEventMap>(): TypedEventBus<TEventMap> {
  const registry = new Map<keyof TEventMap, Set<EventHandler<unknown>>>();

  const erase = <TName extends keyof TEventMap>(
    handler: EventHandler<TEventMap[TName]>,
  ): EventHandler<unknown> => handler as unknown as EventHandler<unknown>;

  const off: TypedEventBus<TEventMap>['off'] = (event, handler) => {
    registry.get(event)?.delete(erase(handler));
  };

  const on: TypedEventBus<TEventMap>['on'] = (event, handler) => {
    let handlers = registry.get(event);
    if (handlers === undefined) {
      handlers = new Set<EventHandler<unknown>>();
      registry.set(event, handlers);
    }
    handlers.add(erase(handler));
    return () => {
      off(event, handler);
    };
  };

  const once: TypedEventBus<TEventMap>['once'] = (event, handler) => {
    const wrapped: EventHandler<TEventMap[typeof event]> = (payload) => {
      off(event, wrapped);
      handler(payload);
    };
    return on(event, wrapped);
  };

  const emit: TypedEventBus<TEventMap>['emit'] = (event, payload) => {
    const handlers = registry.get(event);
    if (handlers === undefined) return;
    for (const handler of [...handlers]) {
      (handler as unknown as EventHandler<typeof payload>)(payload);
    }
  };

  const clear = (): void => {
    registry.clear();
  };

  const listenerCount: TypedEventBus<TEventMap>['listenerCount'] = (event) =>
    registry.get(event)?.size ?? 0;

  return { on, once, off, emit, clear, listenerCount };
}
