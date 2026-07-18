/**
 * `@kernel` — the Simulation Kernel. Deterministic time, seeded xoroshiro128+
 * RNG, the runtime lifecycle state machine, dependency-ordered system registry,
 * the tick runner + deterministic task scheduler, diagnostics, snapshots, and
 * the composed `SimulationKernel`. Domain-agnostic: it drives systems and emits
 * only kernel events, but knows no physics. Depends only on `@core`,
 * `@constants`, `@app-types`, `@utils` — never on frameworks or consumers.
 */
export * from './rng/xoroshiro128plus';
export * from './time/sim-clock';
export * from './fsm/kernel-transitions';
export * from './fsm/kernel-lifecycle';
export * from './registry/system-registry';
export * from './scheduler/scheduler';
export * from './scheduler/task-scheduler';
export * from './lifecycle/lifecycle-manager';
export * from './diagnostics/diagnostics';
export * from './snapshot/snapshot';
export * from './simulation-kernel';
