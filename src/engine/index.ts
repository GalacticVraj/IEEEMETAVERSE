/**
 * `@engine` — System A, the Simulation Engine. The electrical model plus the
 * subsystem contracts (topology, weather, generation, loads, power flow,
 * protection, cascade, restoration, director) and the `SimulationEngine`
 * facade. Pure: depends only on `@core`, `@kernel`, `@app-types`, `@constants`,
 * `@utils`, `@ethics`. Never on the scenario plugin layer or any consumer.
 */
// The legacy Phase-1 grid model. `Generator`/`Load` are intentionally NOT
// re-exported here — the authoritative names now belong to the Phase-3 graph
// engine below. `model/grid.ts` remains for the Phase-1 subsystem placeholders
// and will be reconciled with the graph engine in Phase 4.
export type {
  GridNode,
  PowerLine,
  Zone,
  GridTopology,
  LineFlow,
  ZoneStatus,
  GridState,
  GeneratorStatus,
} from './model/grid';
export * from './graph';
export * from './topology/topology';
export * from './weather/weather';
export * from './generation/generation';
export * from './loads/loads';
export * from './powerflow';
export * from './protection';
export * from './cascade/cascade';
export * from './restoration/restoration';
export * from './director/director';
export * from './simulation-engine';
export * from './scenario-context-factory';
