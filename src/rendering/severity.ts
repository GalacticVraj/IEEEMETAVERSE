/**
 * severity.ts — a pure DISPLAY mapping from observed telemetry to how alarmed
 * the scene should look.
 *
 * This computes no simulation state. It reads numbers the engine already
 * published and returns a single 0..1 grade, exactly the way `stabilityOf` in
 * CommandBar turns the same telemetry into a word. Nothing here feeds back
 * into the simulation, and every input is a measured quantity — so the light
 * going amber is always traceable to a real fault, never to a timer.
 *
 * The grade is the WORST of its components, not their average: a grid with
 * five nominal readings and one district in the dark is in trouble, and
 * averaging would hide exactly the thing the operator must see.
 */

/** Telemetry the scene is allowed to react to. All of it is engine output. */
export interface SeverityInput {
  readonly frequencyHz: number;
  readonly maxLoading: number;
  readonly darkZones: number;
  readonly totalZones: number;
  readonly trippedLines: number;
  readonly uflsStage: number;
}

/** Frequency deviation, in Hz, at which the scene reaches full alarm. */
const FULL_ALARM_DEVIATION_HZ = 1.5;
/** Deviation below which frequency contributes nothing — normal wander. */
const QUIET_DEVIATION_HZ = 0.1;
/** Corridor loading at which stress starts to show in the light. */
const STRESS_FLOOR = 0.75;
/** Trips needed for the trip term alone to saturate. */
const TRIPS_FOR_FULL = 3;
/** UFLS has three stages; the third is the last thing before collapse. */
const UFLS_STAGES = 3;

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

/**
 * 0 = calm daylight operations, 1 = the grid is coming apart.
 *
 * Returns 0 for an empty/idle projection so the hero screen and the pre-shift
 * console are never tinted by a grid that has not started running.
 */
export function crisisGrade(input: SeverityInput): number {
  const { frequencyHz, maxLoading, darkZones, totalZones, trippedLines, uflsStage } = input;

  if (totalZones === 0) return 0;

  const deviation = Math.abs(frequencyHz - 60);
  const frequencyTerm = clamp01(
    (deviation - QUIET_DEVIATION_HZ) / (FULL_ALARM_DEVIATION_HZ - QUIET_DEVIATION_HZ),
  );

  const stressTerm = clamp01((maxLoading - STRESS_FLOOR) / (1 - STRESS_FLOOR));

  // One dark district out of six is already serious, so this term is
  // deliberately steep — half the city dark saturates it.
  const blackoutTerm = clamp01(darkZones / Math.max(1, totalZones / 2));

  const tripTerm = clamp01(trippedLines / TRIPS_FOR_FULL);

  const uflsTerm = clamp01(uflsStage / UFLS_STAGES);

  return Math.max(frequencyTerm, stressTerm, blackoutTerm, tripTerm, uflsTerm);
}

/**
 * Smoothing constant for the on-screen grade. The raw grade can step hard
 * (a trip is instantaneous); the LIGHT must not, or the scene strobes on every
 * relay operation. ~1.2 s to cross most of a step.
 */
export const GRADE_LERP_PER_SECOND = 2.2;
