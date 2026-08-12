/**
 * Under-frequency load shedding — the grid's last automatic defence.
 *
 * When frequency falls far enough that governors cannot arrest it, relays
 * disconnect blocks of load without asking anyone. It is deliberately outside
 * the operator's control: by the time these fire, there is no time for a
 * human decision.
 *
 * The teaching value is precise. UFLS always "works" — frequency recovers and
 * the system survives. But it recovers by making a district dark. A player who
 * acts early never sees stage 1; a player who hesitates watches the grid save
 * itself at the cost of the choice they refused to make.
 *
 * Thresholds follow typical North American practice (three stages between
 * 59.3 and 58.7 Hz shedding roughly a quarter of load in total).
 *
 * Stages LATCH: shed load stays shed until an operator restores it. Real
 * relays behave this way — automatic reconnection into a weak system is how
 * you get a second collapse.
 */

export interface UflsStage {
  readonly stage: number;
  /** Fires at or below this frequency, Hz. */
  readonly thresholdHz: number;
  /** Fraction of total system load disconnected by this stage. */
  readonly shedFraction: number;
}

export const UFLS_STAGES: readonly UflsStage[] = [
  { stage: 1, thresholdHz: 59.3, shedFraction: 0.05 },
  { stage: 2, thresholdHz: 59.0, shedFraction: 0.1 },
  { stage: 3, thresholdHz: 58.7, shedFraction: 0.1 },
];

export interface UflsState {
  /** Stage numbers that have fired, ascending. Latched. */
  readonly firedStages: readonly number[];
}

export const INITIAL_UFLS_STATE: UflsState = { firedStages: [] };

export interface UflsStepResult {
  readonly state: UflsState;
  /** Stages that fired on THIS step — emit one event per entry. */
  readonly newlyTripped: readonly number[];
}

/** Total fraction of system load currently disconnected by UFLS. */
export function totalShedFraction(state: UflsState): number {
  let total = 0;
  for (const stage of UFLS_STAGES) {
    if (state.firedStages.includes(stage.stage)) total += stage.shedFraction;
  }
  return total;
}

/**
 * Evaluate every stage against the present frequency. Pure: returns the next
 * state rather than mutating.
 */
export function stepUfls(state: UflsState, frequencyHz: number): UflsStepResult {
  const newlyTripped: number[] = [];
  for (const stage of UFLS_STAGES) {
    if (state.firedStages.includes(stage.stage)) continue;
    if (frequencyHz <= stage.thresholdHz) newlyTripped.push(stage.stage);
  }

  if (newlyTripped.length === 0) return { state, newlyTripped: [] };

  return {
    state: { firedStages: [...state.firedStages, ...newlyTripped].sort((a, b) => a - b) },
    newlyTripped,
  };
}
