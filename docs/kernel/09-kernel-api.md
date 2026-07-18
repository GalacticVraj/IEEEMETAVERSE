# 09 · Kernel API

`createSimulationKernel(options)` builds the deterministic engine core. It is generic over `TEvents extends KernelEventMap` and returns a `SimulationKernel<TEvents>`. Source: `src/kernel/simulation-kernel.ts`.

```ts
function createSimulationKernel<TEvents extends KernelEventMap = KernelEventMap>(
  options: SimulationKernelOptions<TEvents>,
): SimulationKernel<TEvents>;
```

## Options — `SimulationKernelOptions<TEvents>`

| Option           | Type                     | Default                                 | Purpose                                                                 |
| ---------------- | ------------------------ | --------------------------------------- | ----------------------------------------------------------------------- |
| `seed`           | `number` _(required)_    | —                                       | Makes the entire run reproducible; seeds `xoroshiro128+`.               |
| `frequencyHz`    | `number`                 | —                                       | Simulation frequency (e.g. 5/10/20/30/60 Hz). **Overrides** `timestep`. |
| `timestep`       | `Seconds`                | `DEFAULT_TIMESTEP` (`0.1`s, i.e. 10 Hz) | Explicit fixed timestep.                                                |
| `events`         | `TypedEventBus<TEvents>` | a tick-aware bus the kernel creates     | Inject a shared bus instead of the kernel's own.                        |
| `logger`         | `Logger`                 | `NoopLogger`                            | Injected logger (used as `.child('kernel')`).                           |
| `timeProvider`   | `() => number`           | `() => 0`                               | Injected monotonic wall-clock (ms) for diagnostics/timestamps.          |
| `freezePayloads` | `boolean`                | `false`                                 | Freeze event payloads for immutability (competition mode).              |
| `leakThreshold`  | `number`                 | `MAX_EVENT_LISTENERS` (`100`)           | Warn when an event's listener count exceeds this.                       |

If `frequencyHz` is given, the clock is `createClockFromFrequency(frequencyHz)`; otherwise `createSimClock(timestep ?? DEFAULT_TIMESTEP)`. When no `events` bus is injected, the kernel creates one wired with `tickProvider: () => clock.tick`, the injected `timeProvider`, `freezePayloads`, `leakThreshold`, and an `onLeak` that logs a warning.

## Exposed members

| Member        | Type                      | What it is                                               |
| ------------- | ------------------------- | -------------------------------------------------------- |
| `events`      | `TypedEventBus<TEvents>`  | The tick-aware event bus (kernel-owned unless injected). |
| `clock`       | `Clock`                   | Fixed-timestep virtual clock.                            |
| `rng`         | `Rng`                     | `xoroshiro128+` deterministic RNG.                       |
| `lifecycle`   | `KernelLifecycle`         | The `KernelState` FSM.                                   |
| `registry`    | `SystemRegistry<TEvents>` | System catalogue + `resolveOrder()`.                     |
| `scheduler`   | `TaskScheduler`           | Deterministic timed/repeating task scheduler.            |
| `diagnostics` | `Diagnostics`             | Per-tick/per-system timing (injected wall-clock).        |
| `state`       | `KernelState` _(getter)_  | Current lifecycle state (`lifecycle.state`).             |

## Methods

### Registration & lifecycle

| Method             | Effect                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `register(system)` | Register a `SimulationSystem`. **Only legal in `Boot`** — throws `GridGuardError` otherwise.                        |
| `boot()`           | Walk `Boot → Loading → Configuration → RegisterSystems → Calibration → Idle`; resolve system order; `init` systems. |
| `start()`          | `Idle → Running`.                                                                                                   |
| `pause()`          | `Running → Paused`.                                                                                                 |
| `resume()`         | `Paused → Running`.                                                                                                 |
| `stop()`           | `→ Idle`.                                                                                                           |
| `enterReplay()`    | `→ Replay`.                                                                                                         |
| `exitReplay()`     | `Replay → Idle`.                                                                                                    |
| `shutdown()`       | `→ Shutdown`.                                                                                                       |
| `dispose()`        | `→ Disposed`, then `dispose` systems, `clear` scheduler, `clear` registry, `clear` bus.                             |
| `transition(t)`    | Low-level validated lifecycle transition to `t`.                                                                    |

### Ticking

| Method       | Effect                                                                             |
| ------------ | ---------------------------------------------------------------------------------- |
| `tick()`     | Advance one fixed timestep. **Only legal in `Running` or `Replay`** (else throws). |
| `run(count)` | Call the tick pipeline `count` times.                                              |

The full per-tick sequence is in [02 · Tick Pipeline](./02-tick-pipeline.md).

### Snapshot & reset

| Method       | Effect                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `snapshot()` | `captureKernelSnapshot(clock, rng, orderedSystems)` → `KernelSnapshot`.                                                                 |
| `restore(s)` | `restoreKernelSnapshot(s, clock, rng, orderedSystems)`.                                                                                 |
| `hash()`     | Deterministic FNV-1a hash of the current authoritative state.                                                                           |
| `reset()`    | `reset` systems, `clock.reset()`, restore the **initial** RNG state, `clear` scheduler, `reset` diagnostics. Keeps the lifecycle state. |

## Lifecycle bridge

The kernel subscribes `lifecycle.onChange` and emits `KernelStateChanged { from, to, tick }` on every validated transition, so consumers observe runtime state changes on the same bus as ticks:

```ts
lifecycle.onChange(({ from, to }) => {
  events.emit(KERNEL_EVENT.KernelStateChanged, { from, to, tick: clock.tick });
});
```

## Minimal usage

```ts
const kernel = createSimulationKernel({ seed: 7, frequencyHz: 10, freezePayloads: true });

kernel.register(powerFlowSystem); // before boot
kernel.register(protectionSystem); // declares dependencies: [powerFlowSystem.id]

kernel.boot(); // → Idle (systems resolved + initialized)
kernel.start(); // → Running
kernel.run(100); // 100 deterministic ticks

const fingerprint = kernel.hash(); // reproducible from the same seed
kernel.stop(); // → Idle
kernel.shutdown(); // → Shutdown
kernel.dispose(); // → Disposed (tears everything down)
```

> In the app, the `EVENT_BUS` token resolves to `kernel.events`, so every emitted event is tick-tagged by the kernel's own tick provider.
