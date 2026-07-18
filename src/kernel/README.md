# `kernel/` — `@kernel`

The **Simulation Kernel**: everything that makes the simulation deterministic and orchestrated, independent of any domain physics. It provides the fixed-timestep `SimClock` (virtual time decoupled from wall-clock, with serializable state), the seeded **xoroshiro128+** RNG (SplitMix64-seeded, same seed ⇒ same stream, serializable state), the tick **system-runner** plus a deterministic **task scheduler** (timed/repeating callbacks, no browser timers), the **`SystemRegistry`** (dependency-ordered topological execution, cycle + missing-dependency detection), the lifecycle manager, **diagnostics** (per-tick/per-system timing via an injected wall-clock), **snapshots** (canonical FNV-hashed capture/restore), and the runtime **`KernelLifecycle`** FSM (`Boot → Loading → Configuration → RegisterSystems → Calibration → Idle ⇄ Running ⇄ Paused → Replay → Shutdown → Disposed`; illegal transitions throw).

`createSimulationKernel` composes these into a **generic, domain-agnostic** kernel (`SimulationKernel<TEvents extends KernelEventMap>`): it emits only kernel events (`SimulationTick`, `KernelStateChanged`), drives the tick pipeline, and owns the tick-aware event bus. It knows no power flow, cascades, or gameplay.

**May import:** `@core`, `@constants`, `@app-types`, `@utils`.
**Must not import:** `@engine`, `@scenarios`, any consumer, or any framework (`react`/`three`/`gsap`/`howler`/`zustand`) or the domain `GridEventMap`.

**Key files**

- `simulation-kernel.ts` — `SimulationKernel`, `createSimulationKernel` (boot/start/pause/tick/run/snapshot/restore/hash/…).
- `rng/xoroshiro128plus.ts` — seeded PRNG with the full random surface.
- `time/sim-clock.ts` — `createSimClock` / `createClockFromFrequency` (5/10/20/30/60 Hz).
- `fsm/kernel-lifecycle.ts`, `fsm/kernel-transitions.ts` — runtime FSM + transition table.
- `registry/system-registry.ts` — dependency-ordered registry (`resolveOrder`).
- `scheduler/scheduler.ts` (system runner) · `scheduler/task-scheduler.ts` (timed tasks).
- `diagnostics/diagnostics.ts` · `snapshot/snapshot.ts` — timing + snapshot/hash.

**Phase 2:** **Ready** — real and heavily unit-tested (RNG, clock, FSM, registry, task scheduler, diagnostics, snapshot, and the composed kernel). See `docs/kernel/`.
