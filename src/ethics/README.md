# `ethics/` — `@ethics`

The domain module that **grounds the simulation in real energy data**. It holds the EIA snapshot (real-world generation/demand reference data), model calibration against that data, and equity evaluation of outcomes (who loses power, and is it fair). Ethics is pure data and sits **UPSTREAM of the engine**: the engine imports `@ethics` to calibrate and score, but `@ethics` never imports `@engine` — that would create a dependency cycle. Phase 1 ships the interfaces with `NotImplementedError` placeholders.

**May import:** `@core`, `@utils`, `@app-types`.
**Must not import:** `@engine` (cycle), `@kernel`, `@scenarios`, `@learning`, any consumer, or any framework.

**Key files**

- `eia/eia-snapshot.ts` — EIA reference-data snapshot.
- `calibration/calibration.ts` — calibrate the model against real data.
- `equity/equity.ts` — equity/fairness evaluation of outcomes.

**Phase 1:** **Placeholder** — contracts + `NotImplementedError` stubs.
