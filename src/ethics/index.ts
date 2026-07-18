/**
 * `@ethics` — the domain module that grounds the simulation in real energy data
 * (EIA), calibrates the model, and evaluates the equity of outcomes. Pure and
 * UPSTREAM of the engine: it imports only `@core`, `@app-types`, `@utils`, and
 * never `@engine` (which would create a cycle).
 */
export * from './eia/eia-snapshot';
export * from './calibration/calibration';
export * from './equity/equity';
