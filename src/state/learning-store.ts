import { GRID_EVENT } from '@constants';
import type { GridEventBus, Unsubscribe } from '@core';
import { create } from 'zustand';

/** Read-only projection of the Learner Twin, updated from `LearningUpdated`. */
export interface LearningProjection {
  readonly lastConcept: string | null;
  readonly lastMastery: number;
  readonly updates: number;
}

export const useLearningStore = create<LearningProjection>()(() => ({
  lastConcept: null,
  lastMastery: 0,
  updates: 0,
}));

export function bindLearningStore(bus: GridEventBus): Unsubscribe {
  return bus.on(GRID_EVENT.LearningUpdated, (payload) => {
    useLearningStore.setState((state) => ({
      lastConcept: payload.conceptId,
      lastMastery: payload.mastery,
      updates: state.updates + 1,
    }));
  });
}
