/**
 * Phase 4 — the deterministic DC power-flow solver. Reads the electrical graph
 * through the pure `toDcModel` adapter (the graph stays math-free and is never
 * mutated), solves each island's reduced system Bθ = P, and returns immutable
 * results. No protection, breakers, thermal model, or cascades.
 */
export * from './results';
export * from './powerflow-events';
export * from './linear-solver';
export * from './slack';
export * from './dc-model';
export * from './validation';
export * from './dc-power-flow';
export * from './diagnostics';
