/**
 * `@workers` — the (stubbed) simulation-offload boundary. Message contract and
 * a bridge abstraction so the simulation's execution context can move to a web
 * worker in a later phase without touching consumers.
 */
export * from './messages';
export * from './worker-bridge';
export * from './simulation.worker';
