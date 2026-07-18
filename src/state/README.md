# `state/` — `@state`

Zustand **read-model projections** of authoritative simulation state, updated **BY EVENTS ONLY**. Each store subscribes to the event bus and mirrors what it hears; it never computes, infers, or mutates simulation state. Consumers (UI, rendering, debug) read from here instead of touching the engine. This is the **mechanical guarantee of renderer purity**: because the only way state reaches a component is via a projection rebuilt from events, the renderer literally cannot invent state.

**May import:** `@core` (bus types), `@constants`, `@app-types`, and `zustand`.
**Must not import:** `@engine`, `@kernel`, `@scenarios`, `@learning`, `@ethics`, `@replay` — no authoritative-state source.

**Key files**

- `simulation-store.ts` — `useSimulationStore` + `bindSimulationStore`.
- `learning-store.ts` — `useLearningStore` + `bindLearningStore`.
- `ui-store.ts` — `useUiStore` (local UI state).
- `index.ts` — `bindStores(bus)`, one call that attaches every projection and returns a combined detach.

**Phase 1:** **Ready** — stores and event bindings are real; they populate as the engine begins emitting events in later phases.
