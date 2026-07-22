/**
 * `@state` — Zustand read-model projections of authoritative state. These
 * stores are updated EXCLUSIVELY by subscribing to the event bus; they never
 * compute, infer, or mutate simulation state. Consumers (UI, rendering) read
 * from here. A consumer layer: imports `@core` types, `@app-types`, `@constants`,
 * and `zustand` — never the engine directly (except through the read-only
 * getState() query used by GridStore on each tick event).
 */
import type { GridEventBus, Unsubscribe } from '@core';
import type { ISimulationEngine } from '@engine';

import { bindEventLog } from './event-log-store';
import { bindRunStats } from './run-stats-store';
import { bindGridStore } from './grid-store';
import { bindLearningStore } from './learning-store';
import { bindSimulationStore } from './simulation-store';

export * from './simulation-store';
export * from './learning-store';
export * from './ui-store';
export * from './grid-store';
export * from './app-flow-store';
export * from './event-log-store';
export * from './run-stats-store';

/** Bind every event-driven projection to the bus. Returns a combined detach. */
export function bindStores(
  bus: GridEventBus,
  engine?: ISimulationEngine,
): Unsubscribe {
  const unsubscribers: Unsubscribe[] = [
    bindSimulationStore(bus),
    bindLearningStore(bus),
    bindEventLog(bus),
  ];
  if (engine !== undefined) {
    unsubscribers.push(bindGridStore(bus, engine));
    unsubscribers.push(bindRunStats(bus, engine));
  }
  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
}
