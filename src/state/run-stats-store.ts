/**
 * `RunStatsStore` — real aggregates of the CURRENT run, projection only.
 *
 * Sampled from authoritative GridState on each SimulationTick (the same
 * read-only pattern grid-store uses) plus discrete bus events. Nothing here
 * is computed by the UI and nothing duplicates simulation state — these are
 * accumulations of observed values. Resets on tick regression (restart),
 * freezes on GameEnded.
 */
import { GRID_EVENT } from '@constants';
import type { GridEventBus, Unsubscribe } from '@core';
import type { ISimulationEngine } from '@engine';
import { create } from 'zustand';

export interface RunStats {
  readonly latestTick: number;
  readonly peakDemandMw: number;
  readonly peakGenerationMw: number;
  /** Most negative supply balance (generation − demand) observed. */
  readonly worstBalanceMw: number;
  /** Σ unserved MW per tick — energy not delivered (MW·ticks). */
  readonly unservedEnergyMwTicks: number;
  readonly peakCorridorStress: number;
  /** Running mean of renewable share of generation. */
  readonly renewableShareAvg: number;
  readonly lineTrips: number;
  readonly lineRecoveries: number;
  /** Σ zones dark per tick (zone·ticks). */
  readonly blackoutZoneTicks: number;
  readonly zonesEverDark: readonly string[];
  readonly firstBlackoutTick: number | null;
  /** Tick when the grid returned to fully powered after a blackout. */
  readonly fullRecoveryTick: number | null;
  readonly ended: boolean;
  readonly outcome: string | null;
}

const INITIAL: RunStats = {
  latestTick: 0,
  peakDemandMw: 0,
  peakGenerationMw: 0,
  worstBalanceMw: 0,
  unservedEnergyMwTicks: 0,
  peakCorridorStress: 0,
  renewableShareAvg: 0,
  lineTrips: 0,
  lineRecoveries: 0,
  blackoutZoneTicks: 0,
  zonesEverDark: [],
  firstBlackoutTick: null,
  fullRecoveryTick: null,
  ended: false,
  outcome: null,
};

export const useRunStatsStore = create<RunStats>()(() => INITIAL);

/** Recovery duration in ticks, when a blackout both happened and healed. */
export function recoveryTicksOf(stats: RunStats): number | null {
  if (stats.firstBlackoutTick === null || stats.fullRecoveryTick === null) return null;
  return Math.max(0, stats.fullRecoveryTick - stats.firstBlackoutTick);
}

export function bindRunStats(bus: GridEventBus, engine: ISimulationEngine): Unsubscribe {
  let shareSum = 0;
  let shareSamples = 0;
  let wasDark = false;
  const everDark = new Set<string>();

  const reset = (): void => {
    shareSum = 0;
    shareSamples = 0;
    wasDark = false;
    everDark.clear();
    useRunStatsStore.setState(INITIAL);
  };

  const subs: Unsubscribe[] = [
    bus.on(GRID_EVENT.SimulationTick, (p) => {
      const previous = useRunStatsStore.getState();
      if (p.tick < previous.latestTick) reset();
      if (useRunStatsStore.getState().ended) return;

      const gs = engine.getState();
      const demand = gs.totalLoad as number;
      const generation = gs.totalGeneration as number;
      const balance = generation - demand;

      let maxLoading = 0;
      for (const line of gs.lines) maxLoading = Math.max(maxLoading, line.loading as number);

      let darkZones = 0;
      let unserved = 0;
      for (const zone of gs.zones) {
        if ((zone.state as string) === 'Blackout') {
          darkZones += 1;
          everDark.add(zone.zone as string);
        }
        unserved += zone.unservedLoad as number;
      }

      if (generation > 0) {
        shareSum += (gs.renewableGeneration as number) / generation;
        shareSamples += 1;
      }

      const state = useRunStatsStore.getState();
      const isDark = darkZones > 0;
      useRunStatsStore.setState({
        latestTick: p.tick,
        peakDemandMw: Math.max(state.peakDemandMw, demand),
        peakGenerationMw: Math.max(state.peakGenerationMw, generation),
        worstBalanceMw: Math.min(state.worstBalanceMw, balance),
        unservedEnergyMwTicks: state.unservedEnergyMwTicks + unserved,
        peakCorridorStress: Math.max(state.peakCorridorStress, maxLoading),
        renewableShareAvg: shareSamples > 0 ? shareSum / shareSamples : 0,
        blackoutZoneTicks: state.blackoutZoneTicks + darkZones,
        zonesEverDark: [...everDark],
        firstBlackoutTick:
          state.firstBlackoutTick === null && isDark ? p.tick : state.firstBlackoutTick,
        fullRecoveryTick: wasDark && !isDark ? p.tick : state.fullRecoveryTick,
      });
      wasDark = isDark;
    }),

    bus.on(GRID_EVENT.LineTripped, () => {
      const s = useRunStatsStore.getState();
      if (!s.ended) useRunStatsStore.setState({ lineTrips: s.lineTrips + 1 });
    }),

    bus.on(GRID_EVENT.LineRecovered, () => {
      const s = useRunStatsStore.getState();
      if (!s.ended) useRunStatsStore.setState({ lineRecoveries: s.lineRecoveries + 1 });
    }),

    bus.on(GRID_EVENT.GameEnded, (p) => {
      useRunStatsStore.setState({ ended: true, outcome: p.outcome as string });
    }),
  ];

  return () => {
    for (const unsubscribe of subs) unsubscribe();
  };
}
