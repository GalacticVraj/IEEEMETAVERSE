/**
 * `@kernel` — the Simulation Kernel. Deterministic time, seeded RNG, the
 * lifecycle state machine, system registry, scheduler, and lifecycle manager,
 * composed into `SimulationKernel`. Domain-agnostic: it drives systems but
 * knows no physics. Depends only on `@core`, `@constants`, `@app-types`,
 * `@utils` — never on frameworks or consumers.
 */
export * from './rng/mulberry32';
export * from './time/sim-clock';
export * from './fsm/transitions';
export * from './fsm/simulation-state-machine';
export * from './registry/system-registry';
export * from './scheduler/scheduler';
export * from './lifecycle/lifecycle-manager';
export * from './simulation-kernel';
