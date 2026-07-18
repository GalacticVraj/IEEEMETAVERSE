import type { Ratio } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

/** One observed opportunity to apply a concept (correct or not). */
export interface TraceObservation {
  readonly concept: string;
  readonly correct: boolean;
}

/**
 * Bayesian Knowledge Tracing: given a prior mastery estimate and an
 * observation, produce a posterior. The math the twin uses under the hood.
 */
export interface IKnowledgeTracer {
  update(prior: Ratio, observation: TraceObservation): Ratio;
}

export const KNOWLEDGE_TRACER: Token<IKnowledgeTracer> = createToken('KnowledgeTracer');

/**
 * Placeholder knowledge tracer.
 *
 * PHASE 4 will implement standard BKT with per-concept learn/slip/guess
 * parameters so mastery estimates are principled rather than ad hoc.
 */
export class PlaceholderKnowledgeTracer implements IKnowledgeTracer {
  public update(prior: Ratio, observation: TraceObservation): Ratio {
    return notImplemented(
      'KnowledgeTracer.update',
      'Bayesian Knowledge Tracing posterior from prior + observation.',
      { prior, observation },
    );
  }
}
