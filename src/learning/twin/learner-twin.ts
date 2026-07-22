import type { Ratio } from '@app-types';
import { createToken } from '@core';
import type { Token } from '@core';

import type { ConceptMastery, DecisionRecord, LearnerTwinState } from '../model';

/**
 * The Learner Digital Twin — a live model of what the player understands.
 * Evidence-based: mastery moves only on MEASURED decision outcomes (fed by the
 * EvidenceEngine) and passive run-level observations; confidence grows only
 * with evidence count. It proves improvement with numbers, every run.
 */
export interface ILearnerTwin {
  state(): LearnerTwinState;
  observeDecision(decision: DecisionRecord): void;
  /** Run-level evidence without an explicit decision (half weight). */
  observePassive(concept: string, positive: boolean): void;
  noteBlackout(): void;
  noteZoneSaved(): void;
  /** A run finished — the next one is a new attempt (mentor memory). */
  noteRunCompleted(): void;
  masteryOf(concept: string): Ratio;
}

export const LEARNER_TWIN: Token<ILearnerTwin> = createToken('LearnerTwin');

import { GRID_EVENT } from '@constants';
import type { GridEventBus } from '@core';

/** Prior before any evidence exists. */
const PRIOR_MASTERY = 0.5;
/** Mastery step for a measured optimal / poor decision. */
const ACTIVE_GAIN = 0.12;
const ACTIVE_LOSS = 0.1;
/** Passive observations carry half the weight of measured decisions. */
const PASSIVE_SCALE = 0.5;
/** Concepts below this are "weak" (drives scenario recommendations). */
const WEAK_THRESHOLD = 0.6;
/** confidence = n / (n + K): 1 obs → 0.25, 3 → 0.5, 9 → 0.75. */
const CONFIDENCE_K = 3;

interface ConceptState {
  mastery: number;
  evidenceCount: number;
}

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
    equity_awareness_score: 0.5 as Ratio,
    concepts: [],
  };

  private conceptStates = new Map<string, ConceptState>();

  constructor(private readonly bus: GridEventBus) {}

  public state(): LearnerTwinState {
    return { ...this._state };
  }

  public observeDecision(decision: DecisionRecord): void {
    const newTotal = this._state.decisions_made + 1;
    const newAvgTime =
      (this._state.avg_decision_time_sec * this._state.decisions_made + decision.responseTime) /
      newTotal;

    let correct = this._state.correct_tradeoff_decisions;
    if (decision.optimal) correct++;

    for (const concept of decision.concepts) {
      this.applyEvidence(concept, decision.optimal, 1);
    }

    this._state = {
      ...this._state,
      decisions_made: newTotal,
      avg_decision_time_sec: newAvgTime,
      correct_tradeoff_decisions: correct,
    };
    this.rebuildAggregates();
  }

  public observePassive(concept: string, positive: boolean): void {
    this.applyEvidence(concept, positive, PASSIVE_SCALE);
    this.rebuildAggregates();
  }

  public noteBlackout(): void {
    this._state = { ...this._state, blackouts_caused: this._state.blackouts_caused + 1 };
  }

  public noteZoneSaved(): void {
    this._state = { ...this._state, zones_saved: this._state.zones_saved + 1 };
  }

  public noteRunCompleted(): void {
    this._state = { ...this._state, attempt: this._state.attempt + 1 };
  }

  public masteryOf(concept: string): Ratio {
    return (this.conceptStates.get(concept)?.mastery ?? 0) as Ratio;
  }

  // -------------------------------------------------------------------------

  private applyEvidence(concept: string, positive: boolean, scale: number): void {
    const current = this.conceptStates.get(concept) ?? {
      mastery: PRIOR_MASTERY,
      evidenceCount: 0,
    };
    const delta = (positive ? ACTIVE_GAIN : -ACTIVE_LOSS) * scale;
    const mastery = Math.max(0, Math.min(1, current.mastery + delta));
    const evidenceCount = current.evidenceCount + 1;
    this.conceptStates.set(concept, { mastery, evidenceCount });

    this.bus.emit(GRID_EVENT.LearningUpdated, {
      conceptId: concept,
      mastery: mastery as Ratio,
    });
  }

  private rebuildAggregates(): void {
    const concepts: ConceptMastery[] = Array.from(this.conceptStates.entries()).map(
      ([concept, state]) => ({
        concept,
        mastery: state.mastery as Ratio,
        confidence: (state.evidenceCount / (state.evidenceCount + CONFIDENCE_K)) as Ratio,
        evidenceCount: state.evidenceCount,
      }),
    );

    const weak_concept_tags = concepts
      .filter((c) => (c.mastery as number) < WEAK_THRESHOLD)
      .map((c) => c.concept);

    let understanding_score = 0;
    if (concepts.length > 0) {
      understanding_score =
        concepts.reduce((sum, c) => sum + (c.mastery as number), 0) / concepts.length;
    }

    const equityState = this.conceptStates.get('Equity & Critical Infrastructure');

    this._state = {
      ...this._state,
      concepts,
      weak_concept_tags,
      understanding_score: understanding_score as Ratio,
      equity_awareness_score: (equityState?.mastery ?? 0.5) as Ratio,
    };
  }
}
