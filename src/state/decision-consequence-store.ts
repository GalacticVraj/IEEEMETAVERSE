/**
 * decision-consequence-store.ts — projection of the director's 30-second verdict.
 *
 * Event-driven like every other projection here: it copies a payload the
 * engine already computed and never derives a verdict of its own. The console
 * shows the latest one for a while and then lets it go; the full list stays
 * for the after-action report.
 */
import { GRID_EVENT } from '@constants';
import type { GridEventBus, Unsubscribe } from '@core';
import type { DecisionConsequencePayload } from '@core';
import { create } from 'zustand';

export interface DecisionConsequenceState {
  /** Every consequence measured this run, oldest first. */
  readonly all: readonly DecisionConsequencePayload[];
  /** The one the console is currently showing, or null. */
  readonly current: DecisionConsequencePayload | null;
  readonly dismiss: () => void;
}

export const useDecisionConsequenceStore = create<DecisionConsequenceState>()((set) => ({
  all: [],
  current: null,
  dismiss: () => {
    set({ current: null });
  },
}));

export function bindDecisionConsequences(bus: GridEventBus): Unsubscribe {
  const subs: Unsubscribe[] = [
    bus.on(GRID_EVENT.DecisionConsequence, (payload) => {
      useDecisionConsequenceStore.setState((s) => ({
        all: [...s.all, payload],
        current: payload,
      }));
    }),

    // A restart rewinds the run; the previous shift's verdicts must not
    // survive into the next one.
    bus.on(GRID_EVENT.KernelStateChanged, (payload) => {
      if (payload.from === 'Idle' && payload.to === 'Running') {
        useDecisionConsequenceStore.setState({ all: [], current: null });
      }
    }),
  ];

  return () => {
    for (const unsubscribe of subs) unsubscribe();
  };
}
