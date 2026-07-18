import type { Ratio } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

import type { DecisionRecord, LearnerTwinState } from '../model';

/**
 * The Learner Digital Twin — a live model of what the player understands. It is
 * the measurable-mastery pillar: it proves improvement with numbers, every run.
 */
export interface ILearnerTwin {
  state(): LearnerTwinState;
  observeDecision(decision: DecisionRecord): void;
  masteryOf(concept: string): Ratio;
}

export const LEARNER_TWIN: Token<ILearnerTwin> = createToken('LearnerTwin');

/**
 * Placeholder learner twin.
 *
 * PHASE 4 will maintain per-concept mastery estimates, updated from each scored
 * decision, and emit `LearningUpdated` so the HUD twin widget reflects growth
 * in real time.
 */
export class PlaceholderLearnerTwin implements ILearnerTwin {
  public state(): LearnerTwinState {
    return notImplemented('LearnerTwin.state', 'Return current per-concept mastery estimates.');
  }

  public observeDecision(decision: DecisionRecord): void {
    notImplemented('LearnerTwin.observeDecision', 'Update mastery from a scored decision.', {
      decision,
    });
  }

  public masteryOf(concept: string): Ratio {
    return notImplemented('LearnerTwin.masteryOf', 'Return mastery for a concept.', { concept });
  }
}
