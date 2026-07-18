# `scenarios/` — `@scenarios`

The **plugin crisis-scenario layer**. It defines the `ICrisisScenario` contract (`metadata`, `setup(context)`, `onTick(context)`, `teardown()`) and the `ScenarioRegistry` that registers scenarios by id. The engine core references only the interface, so **new scenarios (heatwave, ice storm, cyber-physical attack, generator loss, …) plug in without modifying the engine** — the open/closed principle applied to content. Scenarios depend on the engine; the engine never depends on scenarios. Phase 1 ships the registry (real) plus one documented `HeatwaveScenario` stub.

**May import:** `@core`, `@engine`, `@kernel`, `@app-types`.
**Must not import:** any consumer (`rendering`/`ui`/`audio`/`state`/`debug`/`infra`/`config`) or any framework.

**Key files**

- `crisis-scenario.ts` — `ICrisisScenario`, `ScenarioMetadata`, `ScenarioContext`.
- `scenario-registry.ts` — `ScenarioRegistry` (real).
- `heatwave/heatwave-scenario.ts` — `HeatwaveScenario` (documented stub).

**Phase 1:** **Ready** contract + registry; **Placeholder** scenario body (heatwave). The engine facade it configures is itself a placeholder, so scenarios cannot run a live sim yet.
