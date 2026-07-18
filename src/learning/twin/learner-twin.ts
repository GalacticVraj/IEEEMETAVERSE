import type { Ratio } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

import type { ConceptMastery, DecisionRecord, LearnerTwinState } from '../model';

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

import { GRID_EVENT } from '@constants';
import type { GridEventBus } from '@core';

export class LearnerTwin implements ILearnerTwin {
  private _state: LearnerTwinState = {
    learner_id: 'demo_001',
    attempt: 1,
    decisions_made: 0,
    correct_tradeoff_decisions: 0,
    blackouts_caused: 0,
    zones_saved: 0,
    avg_decision_time_sec: 0,
    understanding_score: 0 as Ratio,
    weak_concept_tags: [],
    equity_awareness_score: 0 as Ratio,
    concepts: [],
  };

  private conceptMasteryMap = new Map<string, number>();

  constructor(private readonly bus: GridEventBus) {}

  public state(): LearnerTwinState {
    return { ...this._state };
  }

  public observeDecision(decision: DecisionRecord): void {
    // 1. Update decision counts and timing
    const newTotal = this._state.decisions_made + 1;
    const newAvgTime =
      (this._state.avg_decision_time_sec * this._state.decisions_made + decision.responseTime) / newTotal;
    
    let correct = this._state.correct_tradeoff_decisions;
    if (decision.optimal) correct++;

    // 2. Update per-concept mastery (simple moving average for the demo)
    for (const concept of decision.concepts) {
      const current = this.conceptMasteryMap.get(concept) ?? 0.5;
      const change = decision.optimal ? 0.15 : -0.15;
      const newMastery = Math.max(0, Math.min(1, current + change));
      this.conceptMasteryMap.set(concept, newMastery);

      // Emit event so the UI updates
      this.bus.emit(GRID_EVENT.LearningUpdated, {
        conceptId: concept,
        mastery: newMastery as Ratio,
      });
    }

    // Rebuild concepts array
    const concepts: ConceptMastery[] = Array.from(this.conceptMasteryMap.entries()).map(
      ([concept, mastery]) => ({ concept, mastery: mastery as Ratio })
    );

    // Identify weak concepts (< 0.6)
    const weak_concept_tags = concepts
      .filter((c) => c.mastery < 0.6)
      .map((c) => c.concept);

    // Update overall understanding score (average of all concepts)
    let understanding_score = 0;
    if (concepts.length > 0) {
      understanding_score = concepts.reduce((sum, c) => sum + c.mastery, 0) / concepts.length;
    }

    this._state = {
      ...this._state,
      decisions_made: newTotal,
      avg_decision_time_sec: newAvgTime,
      correct_tradeoff_decisions: correct,
      concepts,
      weak_concept_tags,
      understanding_score: understanding_score as Ratio,
    };
  }

  public masteryOf(concept: string): Ratio {
    return (this.conceptMasteryMap.get(concept) ?? 0) as Ratio;
  }
}
