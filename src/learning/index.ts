/**
 * `@learning` — System B, the Learning Engine. The Learner Digital Twin,
 * knowledge tracing, concept graph, reference policy, decision scoring, and
 * analytics, behind a facade. Pure: reads simulation events, never the engine.
 * Imports only `@core`, `@app-types`, `@ethics`, `@utils`.
 */
export * from './model';
export * from './twin/learner-twin';
export * from './knowledge-tracing/knowledge-tracer';
export * from './concept-graph/concept-graph';
export * from './reference-policy/reference-policy';
export * from './scoring/decision-scorer';
export * from './analytics/analytics-collector';
export * from './learning-engine';
export * from './evidence/concepts';
export * from './evidence/evidence-engine';
export * from './scoring/run-score';
