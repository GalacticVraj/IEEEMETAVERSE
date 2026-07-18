/**
 * Phase 5 — the protection layer. Relays decide, breakers switch, and a thermal
 * model tracks line temperature. The engine observes power-flow loadings, never
 * computes power flow, and changes topology ONLY through controlled graph
 * transactions. No cascade orchestration, load shedding, or restoration.
 */
export * from './config';
export * from './curves';
export * from './thermal';
export * from './relay';
export * from './breaker';
export * from './protection-events';
export * from './protection-engine';
export * from './validation';
export * from './diagnostics';
