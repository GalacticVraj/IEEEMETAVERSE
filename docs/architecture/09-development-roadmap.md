# 09 · Development Roadmap

Phase 1 delivers the **foundation**: the real, tested kernel and the full architecture, contracts, and placeholders. Every later phase swaps a placeholder for a real implementation behind an already-fixed interface — a one-line change at the composition root — so the boundaries never move again.

## Phase overview

| Phase  | Theme                         | Delivers                                                                                                                                                                                                                                                                                  | Status   |
| ------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **1**  | Foundation & architecture     | Tooling, layers, `@core` primitives, `@kernel` (clock, RNG, scheduler, registry, lifecycle, FSM), event bus + `GRID_EVENT`, DI + composition root, scenario registry + heatwave stub, config profiles, all interface + placeholder surface, 17 architecture docs, 8 test files / 41 tests | **Done** |
| **2**  | Power flow                    | Real `PowerFlowSolver` (DC → AC), `TopologyService`, `WeatherModel`, `GenerationModel`, `LoadModel`; register engine as a kernel system; boot + tick the loop; `PowerFlowSolved` becomes live                                                                                             | Planned  |
| **3**  | Cascade & protection          | Real `ProtectionSystem` (thermal trip vs `TRIP_THRESHOLD_PU`), `CascadeEngine` (flow redistribution + propagation), `RestorationController`; `LineTripped`/`CascadeStep`/`ZoneBlackout` become live                                                                                       | Planned  |
| **4**  | City geometry                 | Procedural/authored city + grid topology in 3D; districts mapped to zones; scene-graph world structure                                                                                                                                                                                    | Planned  |
| **5**  | Materials & scene             | R3F `<Canvas>`, camera rig, lighting, PBR materials, line/zone visual mapping from projections                                                                                                                                                                                            | Planned  |
| **6**  | Decision wheel + Learner Twin | `Director` decision flow (`DecisionRequested`/`DecisionCommitted`); `LearnerTwin`, `KnowledgeTracer`, `ConceptGraph`, `DecisionScorer`; `LearningUpdated` live                                                                                                                            | Planned  |
| **7**  | Advisor                       | LLM advisor as a **deferred `@infra` external-service adapter** (not a core system); consumes events, offers guidance                                                                                                                                                                     | Planned  |
| **8**  | Ethics / EIA                  | Real `EiaSnapshot`, `CalibrationService`, `EquityAnalyzer`; equity-aware scoring feeding the director/learning                                                                                                                                                                            | Planned  |
| **9**  | Game-feel                     | Audio (`AdaptiveMusic`, ambient, SFX, mixer), postFX pipeline, GSAP transitions, haptics of the console feel                                                                                                                                                                              | Planned  |
| **10** | After-action & replay         | Real `@replay` (record/serialize/verify/timeline/snapshots); After-Action report; `ReplayStarted`/`ReplayFinished` live                                                                                                                                                                   | Planned  |
| **11** | Polish & competition          | Performance passes, accessibility, competition profile hardening, demo scripting, judging evidence                                                                                                                                                                                        | Planned  |

## Dependency of phases

```mermaid
flowchart LR
    P1["1 · Foundation"] --> P2["2 · Power flow"]
    P2 --> P3["3 · Cascade"]
    P2 --> P4["4 · City geometry"]
    P3 --> P5["5 · Materials/scene"]
    P4 --> P5
    P3 --> P6["6 · Decision wheel + Twin"]
    P6 --> P7["7 · Advisor"]
    P6 --> P8["8 · Ethics/EIA"]
    P5 --> P9["9 · Game-feel"]
    P3 --> P10["10 · After-action + Replay"]
    P8 --> P11["11 · Polish/competition"]
    P9 --> P11
    P10 --> P11
    P7 --> P11
```

## What each phase reuses from Phase 1

- **The event contract** (`GRID_EVENT` + `GridEventMap`) is already fixed. Phases 2–3 turn already-catalogued events from documented-but-silent into live.
- **The FSM** (`Boot → … → AfterAction → Replay → Reset`) is real now; later phases drive the transitions rather than redefine them.
- **The composition root** already binds every token to a placeholder. "Implementing phase N" means replacing `new PlaceholderX()` with the real factory — no consumer changes.
- **The projections** (`@state`) already subscribe to the events; as physics goes live the UI/renderer light up with no wiring changes.

## Explicitly deferred (by design, per the spec)

| Item                                            | Where it lands                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM Advisor                                     | Phase 7 — `@infra` external-service adapter, not a core system.                                                                                   |
| Web Worker offload                              | Contract stubbed now (`SIMULATION_WORKER_BRIDGE`); real worker when frame budget under cascade demands it (see [11](./11-performance-budget.md)). |
| Real physics (power flow, cascade, restoration) | Phases 2–3 — placeholders throw `NotImplementedError` today.                                                                                      |
| 3D city + scene                                 | Phases 4–5.                                                                                                                                       |
