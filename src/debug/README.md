# `debug/` — `@debug`

The developer overlay and runtime metrics. A **consumer**: it reads the simulation projection from `@state` and displays FPS, tick rate, seed, sim time, and current FSM state (and later topology graph, active cascades, and event history), backed by a metrics collector. Purely diagnostic — it observes, never computes or mutates simulation state.

**May import:** `@core`, `@state`, `@app-types`, and `react`.
**Must not import:** `@engine` or `@kernel`, `@scenarios`, `@learning`, `@ethics`, `@replay`.

**Key files**

- `debug-overlay.tsx` — the developer HUD overlay.
- `metrics/metrics-collector.ts` — FPS / tick-rate / timing metrics.

**Phase 1:** **Placeholder** — overlay shell wired to the projection; fills in as the sim emits events.
