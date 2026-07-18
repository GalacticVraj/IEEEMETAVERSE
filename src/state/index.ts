/**
 * `@state` — Zustand read-model projections of authoritative state. These
 * stores are updated EXCLUSIVELY by subscribing to the event bus; they never
 * compute, infer, or mutate simulation state. Consumers (UI, rendering) read
 * from here. A consumer layer: imports `@core` types, `@app-types`, `@constants`,
 * and `zustand` — never the engine.
 */
import type { GridEventBus, Unsubscribe } from '@core';

import { bindLearningStore } from './learning-store';
import { bindSimulationStore } from './simulation-store';

export * from './simulation-store';
export * from './learning-store';
export * from './ui-store';

/** Bind every event-driven projection to the bus. Returns a combined detach. */
export function bindStores(bus: GridEventBus): Unsubscribe {
  const unsubscribers: readonly Unsubscribe[] = [bindSimulationStore(bus), bindLearningStore(bus)];
  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
}
