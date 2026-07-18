/**
 * `@core` — the pure kernel primitives and contracts every other layer builds
 * on. Zero runtime dependencies, zero framework imports. This is the bottom of
 * the dependency graph: everything points down toward here, nothing here points
 * up.
 *
 * Contents: error hierarchy, `Result`, the typed event bus + grid event map,
 * the DI container, and the abstract contracts (Clock, Rng, Logger, Serializer,
 * SimulationSystem lifecycle). Concrete implementations live in `@kernel` and
 * `@infra`.
 */
export * from './errors/errors';
export * from './result/result';
export * from './events/event-bus';
export * from './events/grid-events';
export * from './di/container';
export * from './tokens';
export * from './clock/clock';
export * from './rng/rng';
export * from './logging/logger';
export * from './serialization/serializer';
export * from './lifecycle/lifecycle';
