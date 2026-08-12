/**
 * What-if projection for operator actions.
 *
 * The console must be able to say "this lever buys you +0.18 Hz and keeps you
 * out of load shedding" BEFORE the player commits, and that number has to come
 * from the same physics that will judge them afterwards. Anything estimated in
 * the UI would eventually disagree with the simulation, and the moment a
 * teaching tool lies about consequence it stops teaching.
 *
 * This runs the real frequency model forward against a COPY of the operating
 * point. It never touches live state.
 *
 * It deliberately holds generation flat over the horizon: it answers "what
 * does this lever do", not "what will the whole grid do", and crediting
 * unrelated dispatch to the player's action would overstate it.
 */
import { createFrequencyModel } from './frequency-model';
import type { FrequencyMachine } from './frequency-model';

export interface WhatIfInput {
  readonly machines: readonly FrequencyMachine[];
  readonly generationMw: number;
  readonly demandMw: number;
  readonly frequencyHz: number;
  readonly timestepS: number;
  /** Ticks to simulate forward. */
  readonly horizonTicks: number;
  /** MW of demand the candidate action removes. */
  readonly loadReliefMw: number;
}

export interface WhatIfProjection {
  readonly finalFrequencyHz: number;
  readonly lowestFrequencyHz: number;
  /** Change in demand the action causes, MW (negative = relief). */
  readonly deltaDemandMw: number;
  /** True if any UFLS stage would fire within the horizon. */
  readonly uflsWouldFire: boolean;
  readonly finalReserveMw: number;
}

/** Run the real physics forward against a copy. Pure. */
export function projectAction(input: WhatIfInput): WhatIfProjection {
  const model = createFrequencyModel();
  model.restoreState({ frequencyHz: input.frequencyHz, firedStages: [] });

  const demandMw = Math.max(0, input.demandMw - input.loadReliefMw);
  let lowestFrequencyHz = input.frequencyHz;
  let uflsWouldFire = false;
  let finalFrequencyHz = input.frequencyHz;
  let finalReserveMw = 0;

  for (let tick = 0; tick < input.horizonTicks; tick += 1) {
    const out = model.step({
      machines: input.machines,
      generationMw: input.generationMw,
      demandMw,
      timestepS: input.timestepS,
    });
    finalFrequencyHz = out.frequencyHz;
    finalReserveMw = out.reserveMw;
    if (out.frequencyHz < lowestFrequencyHz) lowestFrequencyHz = out.frequencyHz;
    if (out.uflsStage > 0) uflsWouldFire = true;
  }

  return {
    finalFrequencyHz,
    lowestFrequencyHz,
    deltaDemandMw: -input.loadReliefMw,
    uflsWouldFire,
    finalReserveMw,
  };
}
