# GridGuard — Architecture Documentation

GridGuard is a browser-based smart-grid crisis simulator. Its architecture is governed by one non-negotiable philosophy:

> **Simulation First. Rendering Second. UI Third.**

The simulation is the single source of truth. Rendering, UI, audio, replay, analytics, and any future AI are **consumers only** — they may never compute, infer, cache, or mutate authoritative simulation state. Every visual effect has a traceable simulation cause.

These documents describe the Phase-1 foundation: the pure kernel, the layered module boundaries, the typed event spine, and the mechanical guarantees that keep the simulation independent of any framework. Phase 1 ships the real, tested kernel; all domain physics and visuals are documented placeholders.

## Documents

| #   | Document                                                         | What it covers                                                                                                                                   |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| —   | [renderer-purity.md](./renderer-purity.md)                       | The core doctrine: why consumers may only display state, and the mechanical guarantees that enforce it.                                          |
| 01  | [01-high-level-architecture.md](./01-high-level-architecture.md) | The six systems (A–F) + Simulation Kernel on the event bus; layer diagram.                                                                       |
| 02  | [02-folder-structure.md](./02-folder-structure.md)               | Annotated `src/` and `docs/` trees — one responsibility per folder.                                                                              |
| 03  | [03-dependency-graph.md](./03-dependency-graph.md)               | Allowed import directions, forbidden edges, and how ESLint + `tsconfig.engine.json` enforce them.                                                |
| 04  | [04-simulation-data-flow.md](./04-simulation-data-flow.md)       | How one tick flows through the engine subsystems and emits events.                                                                               |
| 05  | [05-rendering-data-flow.md](./05-rendering-data-flow.md)         | Events → Zustand projections → React/R3F reads → visuals. The consumer path.                                                                     |
| 06  | [06-event-architecture.md](./06-event-architecture.md)           | The typed `EventBus`, the `GRID_EVENT` registry catalogue, and the `EventMapIntegrity` compile check.                                            |
| 07  | [07-module-interaction.md](./07-module-interaction.md)           | How kernel, engine, scenarios, learning, replay, state, consumers, and infrastructure interact at runtime.                                       |
| 08  | [08-coding-standards.md](./08-coding-standards.md)               | Strict TS flags, named exports, no `any`/magic numbers, barrels, import boundaries, the `notImplemented` pattern, testing, TSDoc.                |
| 09  | [09-development-roadmap.md](./09-development-roadmap.md)         | Phase 1 (done) through later phases: power flow, cascade, city, materials, decision wheel + twin, advisor, EIA, game-feel, after-action, polish. |
| 10  | [10-risk-analysis.md](./10-risk-analysis.md)                     | Key risks (cascade perf, determinism drift, scope creep, browser compat, art bottleneck) and mitigations.                                        |
| 11  | [11-performance-budget.md](./11-performance-budget.md)           | Frame budget, sim tick rate, adaptive pixel ratio, postprocessing caps, the stubbed worker-offload path.                                         |
| 12  | [12-testing-strategy.md](./12-testing-strategy.md)               | Vitest + v8 coverage; the 8 test files / 41 tests proving the kernel; the `>90%` engine target.                                                  |
| 13  | [13-state-ownership.md](./13-state-ownership.md)                 | Engine owns authoritative state; stores are event-rebuilt projections; UI owns only UI state. Who may write what.                                |
| 14  | [14-initialization-sequence.md](./14-initialization-sequence.md) | `resolveProfile` → `PROFILES` → `bootstrap` → composition root → resolve → `bindStores` → React render.                                          |
| 15  | [15-shutdown-sequence.md](./15-shutdown-sequence.md)             | `beforeunload` → `runtime.shutdown` → `unbindStores` → `kernel.dispose`.                                                                         |

## Reading order

- **New to the project?** Read [renderer-purity.md](./renderer-purity.md), then [01](./01-high-level-architecture.md) and [02](./02-folder-structure.md).
- **Adding a subsystem?** [03](./03-dependency-graph.md), [08](./08-coding-standards.md), [13](./13-state-ownership.md).
- **Adding an event or a consumer?** [06](./06-event-architecture.md), [05](./05-rendering-data-flow.md), [07](./07-module-interaction.md).
- **Building the physics?** [04](./04-simulation-data-flow.md), [09](./09-development-roadmap.md), [11](./11-performance-budget.md), [12](./12-testing-strategy.md).

## Phase-1 status

Real and tested: `@core` primitives, `@kernel` (clock, RNG, scheduler, registry, lifecycle, FSM, kernel), scenario registry, config, utils — **8 test files, 41 tests passing**. Everything in `@engine`, `@rendering`, `@ui`, `@audio` and most of `@learning`/`@ethics`/`@replay` is a documented placeholder that throws `NotImplementedError` via `notImplemented()`. The runtime boots and wires end-to-end but deliberately does **not** tick the placeholder engine.
