# 14 · Initialization Sequence

Startup is a single, deterministic, top-to-bottom sequence: resolve the profile, build the container, resolve the shared bus and kernel, validate the engine wiring, bind projections, then render React. `bootstrap` resolves the kernel **and** the engine to prove DI wiring, but deliberately does **not** `kernel.boot()` or `tick()` yet — the engine is still a placeholder.

> The kernel is real (Phase 2). When it _is_ booted, `kernel.boot()` walks the runtime lifecycle `Boot → Loading → Configuration → RegisterSystems → Calibration → Idle`, resolving the deterministic system order and initializing systems along the way (see [docs/kernel/01](../kernel/01-simulation-lifecycle.md)).

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

## Why bootstrap does NOT boot/tick yet

`bootstrap` intentionally omits `kernel.boot()` and `kernel.tick()`:

- The engine is a **placeholder** — `SimulationEngine.init/step` throw `NotImplementedError`. Booting or ticking it would crash immediately.
- The runtime exists to **prove the wiring end-to-end**: the container resolves, the bus is shared, the kernel is real, projections are bound, and React mounts over them.
- Resolving `SIMULATION_ENGINE` (step 6) still validates that the engine _constructs_ and its dependencies resolve — it just isn't registered as a tickable system.

Turning the loop on is a localized change: register the engine with the kernel (`kernel.register(engine)`), call `kernel.boot()` (which runs the `Boot → … → Idle` walk), `kernel.start()`, and drive `kernel.tick()` from a loop. No consumer or projection wiring changes — they are already listening.

## What is live after bootstrap

- Real: config resolution, DI container, `EVENT_BUS` (the kernel's tick-aware bus), `SIMULATION_KERNEL` (clock/RNG/lifecycle FSM/registry/task scheduler/diagnostics), scenario registry, projections bound to the bus, React tree mounted.
- Silent (by design): the kernel is resolved but **not booted**, so no simulation ticks flow yet — no `SimulationTick`/physics events. The lifecycle FSM can still transition and would emit `KernelStateChanged` if driven.
- The `FoundationScreen` stands in for gameplay UI, showing the resolved `profile` and `seed`.
