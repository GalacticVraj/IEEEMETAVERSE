/**
 * use-crisis-level.ts — the ladder, wired to the live projections.
 *
 * Deliberately NOT a store. The crisis level is derived entirely from
 * telemetry the engine already publishes, and the frozen doctrine forbids a
 * consumer layer from caching simulation-derived state: a second copy can go
 * stale, and then the navbar and the scene disagree about whether the city is
 * on fire. Deriving it per render from the projections keeps exactly one
 * source of truth.
 *
 * The only thing that IS stored is the escalation edge (see `banner-store`),
 * because "which banner is currently on screen" is genuine UI state.
 */
import { AppMode, useAppFlowStore, useGridStore, useSimulationStore } from '@state';

import { assessCrisis } from './crisis-level';
import type { CrisisAssessment } from './crisis-level';

/** Live grade of the running grid, recomputed from projections on each tick. */
export function useCrisisAssessment(): CrisisAssessment {
  const mode = useAppFlowStore((s) => s.mode);
  const frequency = useGridStore((s) => s.frequency);
  const zones = useGridStore((s) => s.zones);
  const trippedCount = useGridStore((s) => s.trippedCount);
  const uflsStage = useGridStore((s) => s.uflsStage);
  const totalLoad = useGridStore((s) => s.totalLoad);
  const totalGeneration = useGridStore((s) => s.totalGeneration);
  const maxLineLoading = useSimulationStore((s) => s.maxLineLoading);

  return assessCrisis({
    // The After-Action screen sits over a stopped grid whose last reading may
    // be a blackout; it should keep showing that, so both live and finished
    // runs count as active. Only the pre-shift console reads standby.
    active: mode === AppMode.ActiveCrisis || mode === AppMode.AfterAction,
    frequencyHz: frequency,
    maxLoading: maxLineLoading,
    darkZones: zones.filter((z) => z.state === 'Blackout').length,
    trippedLines: trippedCount,
    uflsStage,
    deficitMw: Math.max(0, totalLoad - totalGeneration),
  });
}
