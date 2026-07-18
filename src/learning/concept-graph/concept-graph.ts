import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

/** A concept node and its prerequisite edges. */
export interface ConceptNode {
  readonly id: string;
  readonly title: string;
  /** Concepts that should be understood before this one. */
  readonly prerequisites: readonly string[];
}

/**
 * The domain's knowledge structure: which grid concepts exist and how they
 * depend on one another. Used to sequence learning and to attribute decisions
 * to concepts.
 */
export interface IConceptGraph {
  node(id: string): ConceptNode | undefined;
  all(): readonly ConceptNode[];
  prerequisitesOf(id: string): readonly string[];
}

export const CONCEPT_GRAPH: Token<IConceptGraph> = createToken('ConceptGraph');

/**
 * Placeholder concept graph.
 *
 * PHASE 4 will encode the real curriculum (load balancing, N-1 contingency,
 * cascade dynamics, load shedding ethics, restoration) as a prerequisite DAG.
 */
export class PlaceholderConceptGraph implements IConceptGraph {
  public node(id: string): ConceptNode | undefined {
    return notImplemented('ConceptGraph.node', 'Look up a concept node by id.', { id });
  }

  public all(): readonly ConceptNode[] {
    return notImplemented('ConceptGraph.all', 'Return the full concept DAG.');
  }

  public prerequisitesOf(id: string): readonly string[] {
    return notImplemented('ConceptGraph.prerequisitesOf', 'Return prerequisite concept ids.', {
      id,
    });
  }
}
