# 14 · Initialization Sequence

Startup is a single, deterministic, top-to-bottom sequence: resolve the profile, build the container, resolve the shared bus and kernel, validate the engine wiring, bind projections, then render React. Phase 1 deliberately stops short of ticking the placeholder engine.

## Entry point

`src/main.tsx` is the composition entry:

1. `resolveProfile(import.meta.env['VITE_PROFILE'])` → an `AppProfile` (defaults to `development` when unset/unknown).
2. `PROFILES[profile]` → the fully-resolved `AppConfig` (seed, timestep, render tunables, debug flags).
3. `bootstrap(config)` → an `AppRuntime`.
4. `createRoot(#root).render(<App config={config} />)`.
5. Register a `beforeunload` listener that calls `runtime.shutdown()` (see [15](./15-shutdown-sequence.md)).

## `bootstrap` sequence

```mermaid
sequenceDiagram
    autonumber
    participant M as main.tsx
    participant CFG as @config
    participant BS as bootstrap (@infra)
    participant CR as createCompositionRoot
    participant DI as Container
    participant ST as @state
    participant R as React (App)

    M->>CFG: resolveProfile(VITE_PROFILE)
    CFG-->>M: AppProfile
    M->>CFG: PROFILES[profile]
    CFG-->>M: AppConfig
    M->>BS: bootstrap(config)

    BS->>CR: createCompositionRoot(config)
    CR->>DI: registerValue CONFIG_SERVICE / LOGGER / SERIALIZER / EVENT_BUS (real)
    CR->>DI: register SIMULATION_KERNEL (real)
    CR->>DI: register engine subsystems + learning/ethics/replay/audio/debug/workers (placeholders)
    CR->>DI: register SCENARIO_REGISTRY (+ HeatwaveScenario)
    CR-->>BS: Container

    BS->>DI: resolve EVENT_BUS
    BS->>DI: resolve SIMULATION_KERNEL
    BS->>DI: resolve SIMULATION_ENGINE  (validate DI wiring only)
    BS->>ST: bindStores(bus)
    ST-->>BS: unbindStores (combined detach)
    BS-->>M: AppRuntime { container, config, shutdown }

    M->>R: createRoot(#root).render(<App config />)
    R->>R: RenderRoot + FoundationScreen + AppShell (+ DebugOverlay if config.debug.overlay)
    Note over R,ST: consumers read projections; projections already bound to the bus
```

## Step-by-step

| Step | Call                            | Effect                                                                                                          |
| ---- | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1    | `resolveProfile(raw)`           | Map env string → `AppProfile`, defaulting to `development`. Deterministic and tested.                           |
| 2    | `PROFILES[profile]`             | Select the concrete `AppConfig` (seed, timestep, render, debug).                                                |
| 3    | `createCompositionRoot(config)` | Build the DI container; bind every token → concrete impl (real cross-cutting + kernel; placeholders elsewhere). |
| 4    | `resolve(EVENT_BUS)`            | Get the single `GridEventBus` (created via `registerValue`).                                                    |
| 5    | `resolve(SIMULATION_KERNEL)`    | Construct the real kernel, injected with the shared bus + logger + seed + timestep.                             |
| 6    | `resolve(SIMULATION_ENGINE)`    | Eagerly construct the engine **to validate wiring**. It is _not_ registered as a kernel system yet.             |
| 7    | `bindStores(bus)`               | Attach every event-driven projection; capture `unbindStores` for shutdown.                                      |
| 8    | return `AppRuntime`             | `{ container, config, shutdown }`.                                                                              |
| 9    | `render(<App config />)`        | Mount the three consumers; they read projections that are already live-bound.                                   |

## Why Phase 1 does NOT boot/tick the engine

`bootstrap` intentionally omits `kernel.boot()` and `kernel.tick()`:

- The engine is a **placeholder** — `SimulationEngine.init/step` throw `NotImplementedError`. Booting or ticking it would crash immediately.
- The runtime exists to **prove the wiring end-to-end**: the container resolves, the bus is shared, the kernel is real, projections are bound, and React mounts over them.
- Resolving `SIMULATION_ENGINE` (step 6) still validates that the engine _constructs_ and its dependencies resolve — it just isn't registered as a tickable system.

Phase 2 changes this in one place: register the engine with the kernel (`kernel.register(engine)`), call `kernel.boot()`, and drive `kernel.tick()` from a loop. No consumer or projection wiring changes — they are already listening.

## What is live after bootstrap (Phase 1)

- Real: config resolution, DI container, `EVENT_BUS`, `SIMULATION_KERNEL` (clock/RNG/FSM/registry/scheduler), scenario registry, projections bound to the bus, React tree mounted.
- Silent (by design): no simulation ticks, so no `SimulationTick`/physics events flow yet. The FSM can still transition and would emit `SimStateChanged` if driven.
- The `FoundationScreen` stands in for gameplay UI, showing the resolved `profile` and `seed`.
