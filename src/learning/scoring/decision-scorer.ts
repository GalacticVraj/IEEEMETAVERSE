import type { Ratio } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

import type { DecisionSituation, PolicyVerdict } from '../reference-policy/reference-policy';

export interface DecisionScore {
  readonly optionIndex: number;
  readonly optimal: boolean;
  /** Quality of the choice, 0..1 (1 = matched the reference optimum). */
  readonly quality: Ratio;
  readonly concepts: readonly string[];
}

/** Scores a player's decision against the reference policy. */
export interface IDecisionScorer {
  score(
    situation: DecisionSituation,
    verdict: PolicyVerdict,
    chosenOptionIndex: number,
  ): DecisionScore;
}

export const DECISION_SCORER: Token<IDecisionScorer> = createToken('DecisionScorer');

/**
 * Placeholder decision scorer.
 *
 * PHASE 4 will convert the reference verdict + chosen option into a score and
 * attribute it to the concepts the decision exercised, feeding the twin.
 */
export class PlaceholderDecisionScorer implements IDecisionScorer {
  public score(
    situation: DecisionSituation,
    verdict: PolicyVerdict,
    chosenOptionIndex: number,
  ): DecisionScore {
    return notImplemented(
      'DecisionScorer.score',
      'Score a chosen option against the reference verdict and attribute concepts.',
      { situation, verdict, chosenOptionIndex },
    );
  }
}
