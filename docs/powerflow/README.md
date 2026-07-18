# GridGuard — Phase 4: DC Power-Flow Solver

A **deterministic DC power-flow solver** over the electrical graph. Given the
current topology, it computes bus voltage angles and real-power line flows by
solving one linear system per electrical island, then returns an **immutable**
result. Identical inputs always produce identical outputs — there is no
randomness, no wall-clock dependence, and no hidden state.

The solver is a **pure function**. It is invoked on the DI-resolved
`ELECTRICAL_GRAPH`, reads the graph exclusively through the pure `toDcModel`
adapter, and never touches kernel or graph internals. It compiles standalone
(`pnpm typecheck:engine`); the kernel and graph engine are untouched by Phase 4.

## Core principle: the graph stays math-free, the solver never mutates

> The electrical graph carries **topology and nameplate data only** — buses,
> lines (with `reactancePu`, `capacityMw`), transformers, generators, loads,
> breakers, and their connectivity. It knows nothing about susceptance matrices,
> angles, or flows.
>
> All mathematics lives in `src/engine/powerflow/`. The solver **reads** the
> graph (`graph.lines()`, `graph.generators()`, `graph.loads()`,
> `graph.islands()`, `graph.hash`) and builds a **separate** `DcModel`. It never
> writes back, never keeps a parallel topology, and never mutates the graph.
> The graph is the single source of truth for structure; the solver is the
> single source of truth for the numbers derived from it.

This separation is what makes the solver replaceable: a future AC solver
(Newton–Raphson, PV/PQ buses, reactive power) can be swapped in behind the same
read-only surface without changing the graph at all — see
[07-limitations-and-ac-extension.md](./07-limitations-and-ac-extension.md).

## Scope

**In scope (Phase 4):** DC approximation, per-island linear solve, slack-bus
selection, real-power line flows, line loading vs. thermal rating, power
balance, residual, pre/post validation, a deterministic event sequence, and
console diagnostics.

**Deferred:** protection, breakers as switching state, thermal (time-domain)
model, and cascade analysis. Transformers are present in the graph but
**excluded** from the DC branch set until an impedance model exists.

**Phase 5 (next):** call the solver inside the simulation tick, supply real
generation dispatch through the `generationMw` override, and route power-flow
events onto the shared event bus. The Phase-1 placeholder power flow has already
been removed.

## Document index

| Doc                                                                        | Topic                                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [01-dc-assumptions.md](./01-dc-assumptions.md)                             | The DC approximation, when it holds, and what it ignores                                               |
| [02-mathematical-formulation.md](./02-mathematical-formulation.md)         | `b = 1/x`, the `B` matrix, `Bθ = P`, reduced system, line flow, residual, and a worked two-bus example |
| [03-solver-architecture.md](./03-solver-architecture.md)                   | Module map, the solve pipeline, immutable results, and event sequence                                  |
| [04-matrix-construction.md](./04-matrix-construction.md)                   | The `toDcModel` adapter: `B` assembly, injections, island partitioning, transformer exclusion          |
| [05-slack-selection.md](./05-slack-selection.md)                           | The 3-tier deterministic slack rule and one-slack-per-island guarantee                                 |
| [06-validation.md](./06-validation.md)                                     | Pre/post checks, codes, severities, residual and power balance                                         |
| [07-limitations-and-ac-extension.md](./07-limitations-and-ac-extension.md) | Known limitations and how a future AC solver extends this                                              |

## Source map (`src/engine/powerflow/`)

| File                  | Responsibility                                                                  |
| --------------------- | ------------------------------------------------------------------------------- |
| `linear-solver.ts`    | Dense Gaussian elimination with partial pivoting (`solveLinearSystem`)          |
| `slack.ts`            | Deterministic slack-bus selection (`selectSlack`)                               |
| `dc-model.ts`         | Pure graph → math adapter (`toDcModel`), `DcModel` / `DcIsland` / `DcBranch`    |
| `dc-power-flow.ts`    | Orchestrator (`solveDcPowerFlow`), per-island solve                             |
| `results.ts`          | Immutable result types (`PowerFlowResult`, `IslandResult`, `LineFlowResult`, …) |
| `powerflow-events.ts` | `POWER_FLOW_EVENT`, `PowerFlowEventMap` (extends `KernelEventMap`)              |
| `validation.ts`       | `validateSolvable`, `validatePowerFlowResult`                                   |
| `diagnostics.ts`      | Debug/console-only summaries and tables                                         |
| `index.ts`            | Barrel re-export of the public surface                                          |

## Test coverage

161 tests total (24 new for Phase 4): `linear-solver` (6), `slack` (5),
`dc-power-flow` (10 — two-bus exact 100 MW / slack 100 MW / balance /
immutability, three-bus balance, multi-island, no-generator island,
invalid-reactance rejection, determinism, events, diagnostics), and robustness
(3 — 30-bus radial residual < 1e-9, overload loading ≈ 2, reverse flow −80 MW).
