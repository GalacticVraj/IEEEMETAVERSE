# `kernel/` — `@kernel`

The **Simulation Kernel**: everything that makes the simulation deterministic and orchestrated, independent of any domain physics. It provides the fixed-timestep `SimClock` (virtual time decoupled from wall-clock), the seeded `mulberry32` RNG (same seed ⇒ same event stream), the `Scheduler` that advances registered systems in a defined order each tick, the `SystemRegistry` (systems self-register; the kernel knows nothing of their internals), the lifecycle manager (`init → start → tick* → stop → dispose`), and the formal **simulation FSM** (`Boot → Loading → Calibration → Idle → Pre-Crisis → Crisis → Cascade → Recovery → After-Action → Replay → Reset`, illegal transitions throw). `createSimulationKernel` composes these and bridges every FSM change onto the event bus. Domain-agnostic — it drives systems but knows no power flow or cascades.

**May import:** `@core`, `@constants`, `@app-types`, `@utils`.
**Must not import:** `@engine`, `@scenarios`, any consumer, or any framework (`react`/`three`/`gsap`/`howler`/`zustand`).

**Key files**

- `simulation-kernel.ts` — `SimulationKernel`, `createSimulationKernel`, `SIMULATION_KERNEL` token.
- `time/sim-clock.ts`, `rng/mulberry32.ts` — deterministic clock + seeded RNG.
- `scheduler/scheduler.ts`, `registry/system-registry.ts`, `lifecycle/lifecycle-manager.ts`.
- `fsm/simulation-state-machine.ts`, `fsm/transitions.ts` — FSM + legal transition table.

**Phase 1:** **Ready** — real and heavily unit-tested (`simulation-kernel.test.ts`, `sim-clock.test.ts`, `mulberry32.test.ts`, `simulation-state-machine.test.ts`).
