/**
 * concepts.ts — the concept catalog: what each decision teaches.
 * Pure data; ids map to real decision-id prefixes from the operator action
 * catalog and the director's scripted prompts.
 */

export const CONCEPT = {
  DemandResponse: 'Demand Response',
  RenewableIntegration: 'Renewable Integration',
  GridStability: 'Grid Stability',
  CascadingFailure: 'Cascading Failure',
  TransmissionLoading: 'Transmission Loading',
  GridResilience: 'Grid Resilience',
  Equity: 'Equity & Critical Infrastructure',
} as const;

export type ConceptId = (typeof CONCEPT)[keyof typeof CONCEPT];

/** All tracked concepts, in display order. */
export const ALL_CONCEPTS: readonly string[] = Object.values(CONCEPT);

const DECISION_CONCEPTS: readonly { prefix: string; concepts: readonly string[] }[] = [
  { prefix: 'op-ac-residential', concepts: [CONCEPT.DemandResponse, CONCEPT.TransmissionLoading] },
  { prefix: 'op-ev-pause', concepts: [CONCEPT.DemandResponse, CONCEPT.TransmissionLoading] },
  { prefix: 'op-lights-commercial', concepts: [CONCEPT.DemandResponse, CONCEPT.TransmissionLoading] },
  { prefix: 'op-shed-industrial', concepts: [CONCEPT.GridResilience, CONCEPT.TransmissionLoading] },
  { prefix: 'op-shed-harbor', concepts: [CONCEPT.GridResilience, CONCEPT.Equity] },
  { prefix: 'dec-overload', concepts: [CONCEPT.TransmissionLoading, CONCEPT.DemandResponse] },
  { prefix: 'dec-cascade', concepts: [CONCEPT.CascadingFailure, CONCEPT.GridResilience] },
  { prefix: 'dec-blackout', concepts: [CONCEPT.GridResilience, CONCEPT.GridStability] },
];

/** Concepts a decision exercises (by real decision-id prefix). */
export function conceptsForDecision(decisionId: string): readonly string[] {
  for (const entry of DECISION_CONCEPTS) {
    if (decisionId.startsWith(entry.prefix)) return entry.concepts;
  }
  return [CONCEPT.GridStability];
}
