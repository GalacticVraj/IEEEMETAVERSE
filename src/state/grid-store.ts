/**
 * `GridStore` — a Zustand projection of the live grid state.
 *
 * Updated exclusively from events on the GridEventBus; never computes
 * simulation state. The Three.js scene and the HUD panel read from here.
 *
 * On each SimulationTick, the store reads the authoritative GridState from
 * ISimulationEngine.getState() (the engine is a read-only query point here —
 * the store does NOT compute, it merely copies scalars into React-observable
 * fields). This is correct per the architecture: projections may READ engine
 * state; they just must not MUTATE it.
 */
import { GRID_EVENT } from '@constants';
import type { GridEventBus, Unsubscribe } from '@core';
import type { ISimulationEngine } from '@engine';
import type { LineFlow } from '@engine';
import { create } from 'zustand';

export interface GridProjection {
  readonly tick: number;
  readonly totalGeneration: number;
  readonly totalLoad: number;
  readonly frequency: number;
  readonly lines: readonly LineFlow[];
  /** Set of line IDs that are currently open (tripped or commanded open). */
  readonly openLines: ReadonlySet<string>;
  readonly trippedCount: number;
}

const INITIAL: GridProjection = {
  tick: 0,
  totalGeneration: 0,
  totalLoad: 0,
  frequency: 50,
  lines: [],
  openLines: new Set(),
  trippedCount: 0,
};

export const useGridStore = create<GridProjection>()(() => INITIAL);

/**
 * Bind the GridStore to the event bus + engine. Call once at bootstrap.
 * Returns an unsubscribe that detaches all listeners.
 */
export function bindGridStore(
  bus: GridEventBus,
  engine: ISimulationEngine,
): Unsubscribe {
  const subs: Unsubscribe[] = [

    bus.on(GRID_EVENT.SimulationTick, (p) => {
      const gs = engine.getState();
      useGridStore.setState({
        tick: p.tick,
        totalGeneration: gs.totalGeneration as number,
        totalLoad: gs.totalLoad as number,
        frequency: gs.frequency as number,
        lines: gs.lines as readonly LineFlow[],
      });
    }),

    bus.on(GRID_EVENT.LineTripped, (p) => {
      const prev = useGridStore.getState();
      const openLines = new Set<string>(prev.openLines);
      openLines.add(p.line as string);
      useGridStore.setState({ openLines, trippedCount: openLines.size });
    }),

    bus.on(GRID_EVENT.LineRecovered, (p) => {
      const prev = useGridStore.getState();
      const openLines = new Set<string>(prev.openLines);
      openLines.delete(p.line as string);
      useGridStore.setState({ openLines, trippedCount: openLines.size });
    }),

  ];

  return () => { for (const u of subs) u(); };
}
