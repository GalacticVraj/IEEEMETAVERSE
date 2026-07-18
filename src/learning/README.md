# `learning/` — `@learning`

**System B, the Learning Engine.** The Learner Digital Twin plus knowledge tracing, a concept graph, a reference policy, decision scoring, and analytics, all behind a `LearningEngine` facade. It is a **pure consumer of simulation events** — it observes `DecisionCommitted`, outcomes, and other events on the bus to update its estimates and emit `LearningUpdated`. It never reaches into the engine or computes authoritative state. Phase 1 provides the interfaces and models with `NotImplementedError` placeholders.

**May import:** `@core`, `@ethics`, `@utils`, `@app-types`.
**Must not import:** `@engine`, `@kernel`, `@scenarios`, any consumer (`rendering`/`ui`/`audio`/`state`/`debug`/`infra`/`config`), or any framework.

**Key files**

- `learning-engine.ts`, `model.ts` — facade + shared learner types.
- `twin/learner-twin.ts` — the Learner Digital Twin.
- `knowledge-tracing/knowledge-tracer.ts`, `concept-graph/concept-graph.ts`.
- `reference-policy/reference-policy.ts`, `scoring/decision-scorer.ts`, `analytics/analytics-collector.ts`.

**Phase 1:** **Placeholder** — contracts + `NotImplementedError` stubs.
