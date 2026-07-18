# 06 · Event Architecture

The event bus is the spine of the whole system. The simulation emits; consumers subscribe; there is **zero polling**. Every event name and every payload is strongly typed, and the compiler guarantees the name registry and the payload map can never drift apart.

## The typed `EventBus`

`createEventBus<TEventMap>()` in `@core` returns a `TypedEventBus<TEventMap>` — an in-memory, synchronous, ordered publish/subscribe bus generic over an event map (name → payload type).

| Method                | Signature (inferred)                | Purpose                                             |
| --------------------- | ----------------------------------- | --------------------------------------------------- |
| `on(name, handler)`   | payload inferred from `name`        | Subscribe; returns an `Unsubscribe`.                |
| `once(name, handler)` | payload inferred                    | Subscribe for one dispatch, then auto-remove.       |
| `off(name, handler)`  | payload inferred                    | Remove a specific handler.                          |
| `emit(name, payload)` | payload type-checked against `name` | Synchronously dispatch to all handlers.             |
| `clear()`             | —                                   | Remove every subscription (used on shutdown/reset). |
| `listenerCount(name)` | —                                   | Introspection for debug.                            |

Key properties:

- **Type inference:** `on('LineTripped', h)` infers `h`'s parameter as `LineTrippedPayload`. A wrong payload shape is a compile error; there are no untyped event strings.
- **Snapshot dispatch:** `emit` iterates a copy (`[...handlers]`), so a handler may subscribe/unsubscribe during dispatch without corrupting the current fan-out.
- **Single instance:** the kernel owns the one `GridEventBus` (`TypedEventBus<GridEventMap>`) and exposes it to consumers via the `EVENT_BUS` token. No layer creates its own.

`GridEventBus = TypedEventBus<GridEventMap>`. The bus is registered as a real value at the composition root (`registerValue(EVENT_BUS, createEventBus<GridEventMap>())`) and injected into the kernel, `@state`, and every consumer.

## The `GRID_EVENT` registry

Event names are never string literals in code. `constants/events.ts` exports `GRID_EVENT` (a `const` object) and the derived `GridEventName` union. All code references `GRID_EVENT.X`; the matching payload interface lives in `@core/events/grid-events` (`GridEventMap`).

### Catalogue

Payloads carry only **ids, scalars, and enums** — never engine model objects — which is what keeps `@core` independent of `@engine`.

| Event               | Payload summary                         | Typical emitter           | Typical subscribers                           |
| ------------------- | --------------------------------------- | ------------------------- | --------------------------------------------- |
| `SimulationTick`    | `{ tick, simTime, timestep }`           | kernel                    | `@state`, `@replay`, `@debug`                 |
| `SimStateChanged`   | `{ from, to, tick }` (FSM)              | kernel (bridged from FSM) | `@state`, `@ui`, `@audio`, `@replay`          |
| `WeatherChanged`    | `{ kind, temperature }`                 | engine · weather          | `@rendering`, `@audio`, `@state`              |
| `LoadChanged`       | `{ zone, demand }`                      | engine · loads            | `@state`, `@ui`                               |
| `GenerationChanged` | `{ generator, output }`                 | engine · generation       | `@state`, `@ui`                               |
| `PowerFlowSolved`   | `{ converged, iterations, maxLoading }` | engine · powerflow        | `@state`, `@rendering`, `@ui`                 |
| `LineOverloaded`    | `{ line, loading }`                     | engine · protection       | `@rendering`, `@audio`, `@ui`                 |
| `LineTripStarted`   | `{ line, delay }`                       | engine · protection       | `@rendering`, `@audio`                        |
| `LineTripped`       | `{ line, cause }`                       | engine · protection       | `@rendering`, `@audio`, `@state`, `@learning` |
| `LineCooling`       | `{ line }`                              | engine · restoration      | `@rendering`                                  |
| `LineRecovered`     | `{ line }`                              | engine · restoration      | `@rendering`, `@audio`                        |
| `CascadeStarted`    | `{ cascadeId, originLine }`             | engine · cascade          | `@rendering`, `@audio`, `@ui`, `@learning`    |
| `CascadeStep`       | `{ cascadeId, step, trippedLine }`      | engine · cascade          | `@rendering`, `@audio`                        |
| `CascadeEnded`      | `{ cascadeId, totalSteps, contained }`  | engine · cascade          | `@ui`, `@learning`, `@state`                  |
| `ZonePowered`       | `{ zone }`                              | engine · restoration      | `@rendering`, `@audio`                        |
| `ZoneBlackout`      | `{ zone, unservedLoad }`                | engine · restoration      | `@rendering`, `@audio`, `@ui`, `@learning`    |
| `DecisionRequested` | `{ decisionId, prompt, options }`       | engine · director         | `@ui` (decision wheel)                        |
| `DecisionCommitted` | `{ decisionId, optionIndex, simTime }`  | `@ui` → engine            | engine · director, `@learning`, `@replay`     |
| `LearningUpdated`   | `{ conceptId, mastery }`                | `@learning`               | `@state` (learning store), `@ui`              |
| `ReplayStarted`     | `{ recordingId }`                       | `@replay`                 | `@ui`, `@rendering`, `@audio`                 |
| `ReplayFinished`    | `{ recordingId, verified }`             | `@replay`                 | `@ui`                                         |
| `GameEnded`         | `{ outcome, score }`                    | engine · director         | `@ui`, `@audio`, `@learning`, `@replay`       |

> `DecisionCommitted` is the one event a consumer emits — user intent travelling _forward_ to the engine (see [05](./05-rendering-data-flow.md)). Everything else flows simulation → consumers.

## The `EventMapIntegrity` compile check

Adding an event means touching **two** places: `GRID_EVENT` (the name) and `GridEventMap` (the payload). A compile-time assertion in `grid-events.ts` guarantees they stay in lockstep:

```ts
type Assert<T extends true> = T;
type MutuallyExtends<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type EventMapIntegrity = Assert<MutuallyExtends<keyof GridEventMap, GridEventName>>;
```

If `keyof GridEventMap` and `GridEventName` are ever not the exact same set — a name added to one but not the other — `Assert` receives `false`, and the file fails to compile. There is no runtime cost and no way to forget the pairing.

```mermaid
flowchart LR
    A["GRID_EVENT registry\n(constants/events.ts)"] --> C["GridEventName union"]
    B["GridEventMap\n(core/events/grid-events.ts)"] --> D["keyof GridEventMap"]
    C --> E{"EventMapIntegrity\nMutuallyExtends?"}
    D --> E
    E -->|not equal| F["compile error"]
    E -->|equal| G["OK"]
```

## Emission and subscription rules

1. **No string literals.** Always `GRID_EVENT.X`; never `'X'`.
2. **The simulation emits; consumers subscribe.** The only forward-flowing exception is `DecisionCommitted`.
3. **Payloads are lightweight facts.** Ids + scalars + enums only; consumers read richer detail from `@state` projections.
4. **One bus.** Injected via `EVENT_BUS`; created once at the composition root; `clear()`ed on shutdown.
