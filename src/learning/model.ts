import type { DecisionId, Ratio, Seconds } from '@app-types';

/** A single operator decision, enriched by the scorer after the fact. */
export interface DecisionRecord {
  readonly decisionId: DecisionId;
  readonly optionIndex: number;
  readonly simTime: Seconds;
  /** Concept ids this decision exercised. */
  readonly concepts: readonly string[];
  /** Whether the option matched the reference policy's optimum. */
  readonly optimal: boolean;
  /** Time taken to decide (a proxy for confidence/automaticity). */
  readonly responseTime: Seconds;
}

/** Estimated mastery of a single concept, 0..1. */
export interface ConceptMastery {
  readonly concept: string;
  readonly mastery: Ratio;
}

/** The observable state of the Learner Digital Twin. */
export interface LearnerTwinState {
  readonly concepts: readonly ConceptMastery[];
  readonly decisionsObserved: number;
}
