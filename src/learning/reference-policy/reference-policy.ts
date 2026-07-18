import type { Ratio } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

/** A neutral, engine-independent description of a decision to evaluate. */
export interface DecisionSituation {
  readonly prompt: string;
  readonly options: readonly string[];
  /** Feature vector summarizing grid stress at decision time (0..1 each). */
  readonly features: Readonly<Record<string, number>>;
}

export interface PolicyVerdict {
  /** Index of the option the reference policy considers optimal. */
  readonly optimalIndex: number;
  /** Regret of each option relative to the optimum, 0..1. */
  readonly regret: readonly Ratio[];
}

/**
 * The "expert" baseline the player is scored against. Given a situation, it
 * says which action is best — the yardstick for decision scoring.
 */
export interface IReferencePolicy {
  evaluate(situation: DecisionSituation): PolicyVerdict;
}

export const REFERENCE_POLICY: Token<IReferencePolicy> = createToken('ReferencePolicy');

/**
 * Placeholder reference policy.
 *
 * PHASE 4 will implement a defensible heuristic/optimization baseline (e.g.
 * minimize expected unserved energy subject to protecting critical loads),
 * kept deterministic so scoring is reproducible.
 */
export class PlaceholderReferencePolicy implements IReferencePolicy {
  public evaluate(situation: DecisionSituation): PolicyVerdict {
    return notImplemented(
      'ReferencePolicy.evaluate',
      'Return the optimal option index and per-option regret for a situation.',
      { situation },
    );
  }
}
