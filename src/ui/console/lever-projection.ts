/**
 * lever-projection.ts — what an operator lever would actually buy.
 *
 * The console must be able to say what a lever does BEFORE the player commits,
 * using the same physics that will judge them afterwards. `projectAction` in
 * the engine supplies that; this module frames the result the way an operator
 * reads it.
 *
 * The framing is the whole point. An earlier version reported the RAW change
 * in frequency, which is wrong in a way that actively misleads: shedding
 * 78 MW off a balanced 60.00 Hz grid drives it to ~62.3 Hz, and reporting
 * "+2.31 Hz" as a benefit would recommend causing a dangerous over-frequency
 * excursion. What matters is movement TOWARD nominal — a lever only helps if
 * it shrinks |f − 60|.
 */
import { NOMINAL_FREQUENCY } from '@constants';
import { projectAction } from '@engine/frequency';
import type { FrequencyMachine } from '@engine/frequency';

const NOMINAL_HZ = NOMINAL_FREQUENCY as number;

/** How far ahead the projection looks: 5 s at the 10 Hz tick rate. */
const PROJECTION_TICKS = 50;
const PROJECTION_TIMESTEP_S = 0.1;

/** Below this the movement is not worth claiming as an effect. */
const MEANINGFUL_HZ = 0.01;

export interface LeverOperatingPoint {
  readonly machines: readonly FrequencyMachine[];
  readonly generationMw: number;
  readonly demandMw: number;
  readonly frequencyHz: number;
}

export interface LeverSummary {
  /** Where frequency ends up if the operator does nothing. */
  readonly doNothingHz: number;
  /** Where frequency ends up if this lever is pulled. */
  readonly projectedHz: number;
  /** Reduction in |f − 60|. Positive means closer to nominal. */
  readonly deviationImprovementHz: number;
  /** True when the lever moves frequency meaningfully toward nominal. */
  readonly helps: boolean;
  /** True when the lever pushes frequency past nominal the other way. */
  readonly overshoots: boolean;
  /** True when relays would still fire even after pulling this lever. */
  readonly wouldStillShed: boolean;
  /** True when this lever is what prevents automatic shedding. */
  readonly avertsShedding: boolean;
}

/**
 * Run the real physics forward twice — once doing nothing, once with the
 * lever — and describe the difference in operator terms. Pure; touches no
 * live state.
 */
export function summariseLever(point: LeverOperatingPoint, reliefMw: number): LeverSummary {
  const base = {
    machines: point.machines,
    generationMw: point.generationMw,
    demandMw: point.demandMw,
    frequencyHz: point.frequencyHz,
    timestepS: PROJECTION_TIMESTEP_S,
    horizonTicks: PROJECTION_TICKS,
  };

  const doNothing = projectAction({ ...base, loadReliefMw: 0 });
  const withLever = projectAction({ ...base, loadReliefMw: reliefMw });

  const deviationBefore = Math.abs(doNothing.finalFrequencyHz - NOMINAL_HZ);
  const deviationAfter = Math.abs(withLever.finalFrequencyHz - NOMINAL_HZ);
  const deviationImprovementHz = deviationBefore - deviationAfter;

  // Overshoot is judged on which SIDE of nominal the lever lands on, not on
  // the size of the move: crossing from a deficit into a surplus is a new
  // problem, not a smaller one.
  const overshoots = withLever.finalFrequencyHz > NOMINAL_HZ + MEANINGFUL_HZ;

  return {
    doNothingHz: doNothing.finalFrequencyHz,
    projectedHz: withLever.finalFrequencyHz,
    deviationImprovementHz,
    helps: !overshoots && deviationImprovementHz > MEANINGFUL_HZ,
    overshoots,
    wouldStillShed: withLever.uflsWouldFire,
    avertsShedding: doNothing.uflsWouldFire && !withLever.uflsWouldFire,
  };
}
