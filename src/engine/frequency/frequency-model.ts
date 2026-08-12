/**
 * FrequencyModel — the system's rotational dynamics, composed.
 *
 * Each tick: recompute inertia from the machines actually online, integrate
 * the swing equation against the present imbalance, then let the UFLS relays
 * look at the result. Reserve/N-1 screening rides along because it needs the
 * same snapshot.
 *
 * Ordering matters. UFLS evaluates AFTER integration, on the frequency the
 * step produced — a relay responds to the frequency that exists, not the one
 * that existed before the imbalance was applied.
 *
 * Governor action is NOT a separate power term here. The generation model
 * already ramps units toward demand with per-kind rate limits, which is
 * mechanically what a governor does; adding a parallel droop injection would
 * double-count primary response. Droop instead scales that ramp's urgency —
 * see `generation.ts`.
 */
import { systemInertiaMwS } from './inertia';
import type { MachineInertiaInput } from './inertia';
import { assessReserve } from './reserve';
import type { ReserveUnit, SecurityVerdict } from './reserve';
import { NOMINAL_HZ, stepSwing } from './swing';
import { INITIAL_UFLS_STATE, stepUfls, totalShedFraction } from './ufls';
import type { UflsState } from './ufls';

/** One machine as the frequency model sees it. */
export interface FrequencyMachine extends MachineInertiaInput, ReserveUnit {
  readonly id: string;
  readonly kind: string;
  readonly ratedMw: number;
  readonly outputMw: number;
  readonly online: boolean;
}

export interface FrequencyStepInput {
  readonly machines: readonly FrequencyMachine[];
  /** Total mechanical power delivered this tick, MW. */
  readonly generationMw: number;
  /** Total electrical demand served this tick, MW. */
  readonly demandMw: number;
  readonly timestepS: number;
}

export interface FrequencyStepOutput {
  readonly frequencyHz: number;
  readonly rocofHzPerS: number;
  readonly inertiaMwS: number;
  /** Highest UFLS stage that has fired; 0 when none. */
  readonly uflsStage: number;
  readonly uflsShedFraction: number;
  /** Stages that fired on THIS step — emit one event each. */
  readonly uflsNewlyTripped: readonly number[];
  readonly security: SecurityVerdict;
  readonly reserveMw: number;
  readonly largestInfeedMw: number;
}

interface InternalState {
  readonly frequencyHz: number;
  readonly ufls: UflsState;
}

export interface FrequencyModel {
  step(input: FrequencyStepInput): FrequencyStepOutput;
  getState(): InternalState;
  reset(): void;
  captureState(): unknown;
  restoreState(state: unknown): void;
}

const INITIAL: InternalState = {
  frequencyHz: NOMINAL_HZ,
  ufls: INITIAL_UFLS_STATE,
};

export function createFrequencyModel(): FrequencyModel {
  let state: InternalState = INITIAL;

  return {
    step(input: FrequencyStepInput): FrequencyStepOutput {
      const inertiaMwS = systemInertiaMwS(input.machines);

      const swing = stepSwing({
        frequencyHz: state.frequencyHz,
        mechanicalMw: input.generationMw,
        electricalMw: input.demandMw,
        inertiaMwS,
        timestepS: input.timestepS,
      });

      const ufls = stepUfls(state.ufls, swing.frequencyHz);
      state = { frequencyHz: swing.frequencyHz, ufls: ufls.state };

      const reserve = assessReserve(input.machines, input.demandMw, inertiaMwS);
      const firedStages = ufls.state.firedStages;

      return {
        frequencyHz: swing.frequencyHz,
        rocofHzPerS: swing.rocofHzPerS,
        inertiaMwS,
        uflsStage: firedStages.length === 0 ? 0 : (firedStages[firedStages.length - 1] ?? 0),
        uflsShedFraction: totalShedFraction(ufls.state),
        uflsNewlyTripped: ufls.newlyTripped,
        security: reserve.verdict,
        reserveMw: reserve.reserveMw,
        largestInfeedMw: reserve.largestInfeedMw,
      };
    },

    getState(): InternalState {
      return state;
    },

    reset(): void {
      state = INITIAL;
    },

    captureState(): unknown {
      return { frequencyHz: state.frequencyHz, firedStages: [...state.ufls.firedStages] };
    },

    restoreState(snapshot: unknown): void {
      const s = snapshot as { frequencyHz: number; firedStages: number[] };
      state = {
        frequencyHz: s.frequencyHz,
        ufls: { firedStages: [...s.firedStages] },
      };
    },
  };
}
