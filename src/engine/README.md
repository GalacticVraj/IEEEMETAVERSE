# `engine/` — `@engine`

**System A, the Simulation Engine** — the single source of truth. It owns the authoritative electrical model (`GridTopology` / `GridState`) and the subsystem contracts that evolve it each tick, in physical order: **weather → generation → loads → power flow → protection → cascade → restoration → director**. The `SimulationEngine` facade is the one `SimulationSystem` the kernel registers; everything it computes is published as events, and nothing outside the engine may mutate its state. In Phase 1 the facade and every subsystem are documented placeholders that throw `NotImplementedError` via `notImplemented()` — the interfaces and TSDoc for future physics exist, but no simulation runs.

**May import:** `@core`, `@kernel`, `@ethics`, `@utils`, `@constants`, `@app-types`.
**Must not import:** `@scenarios` (engine core references only the `ICrisisScenario` contract), any consumer (`rendering`/`ui`/`audio`/`state`/`debug`/`infra`/`config`), or any framework.

**Key files**

- `simulation-engine.ts` — `ISimulationEngine` facade, `PlaceholderSimulationEngine`, `SIMULATION_ENGINE` token.
- `model/grid.ts` — `GridTopology` / `GridState` authoritative data.
- `topology/`, `weather/`, `generation/`, `loads/`, `powerflow/power-flow.ts`, `protection/`, `cascade/`, `restoration/`, `director/` — subsystem placeholders.

**Phase 1:** **Placeholder** — contracts + `NotImplementedError` stubs; real physics lands in later phases.
