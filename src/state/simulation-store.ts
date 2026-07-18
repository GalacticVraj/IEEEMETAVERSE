import { KernelState } from '@app-types';
import { GRID_EVENT } from '@constants';
import type { GridEventBus, Unsubscribe } from '@core';
import { create } from 'zustand';

/**
 * A READ-ONLY projection of authoritative simulation state, for UI/rendering to
 * subscribe to. It is rebuilt from events — it never computes simulation. This
 * store contains no logic beyond copying event payloads into React-observable
 * fields, which is the mechanical guarantee that the renderer cannot invent
 * state. See docs/architecture/renderer-purity.md.
 */
export interface SimulationProjection {
  readonly tick: number;
  readonly simTime: number;
  /** The kernel runtime lifecycle state. */
  readonly lifecycle: KernelState;
  readonly maxLineLoading: number;
}

export const useSimulationStore = create<SimulationProjection>()(() => ({
  tick: 0,
  simTime: 0,
  lifecycle: KernelState.Boot,
  maxLineLoading: 0,
}));

/**
 * Bind the projection to the event bus. Called once at bootstrap. Returns an
 * unsubscribe that detaches all listeners (used on shutdown).
 */
export function bindSimulationStore(bus: GridEventBus): Unsubscribe {
  const unsubscribers: readonly Unsubscribe[] = [
    bus.on(GRID_EVENT.SimulationTick, (payload) => {
      useSimulationStore.setState({ tick: payload.tick, simTime: payload.simTime });
    }),
    bus.on(GRID_EVENT.KernelStateChanged, (payload) => {
      useSimulationStore.setState({ lifecycle: payload.to });
    }),
    bus.on(GRID_EVENT.PowerFlowSolved, (payload) => {
      useSimulationStore.setState({ maxLineLoading: payload.maxLoading });
    }),
  ];
  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
}
