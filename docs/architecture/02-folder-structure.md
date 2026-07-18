# 02 · Folder Structure

One folder = one responsibility. Every `src/*` module has a barrel `index.ts` and a path alias. The tree is ordered bottom-up: pure leaves first, consumers last.

## `src/` tree

```
src/
├── main.tsx                     App entry: resolveProfile → PROFILES → bootstrap → React render
├── App.tsx                      Composes the three visual consumers (RenderRoot, UI, DebugOverlay)
├── index.css                    Tailwind entry
│
├── types/            @app-types  Dependency-free type vocabulary (imports nothing)
│   ├── brand.ts                 Brand<T, Tag> nominal-typing helper
│   ├── ids.ts                   Branded ids: NodeId, LineId, ZoneId, GeneratorId, SystemId, …
│   ├── units.ts                 Branded units: MegaWatts, PerUnit, Hertz, Seconds, Ratio, …
│   ├── enums.ts                 LineState, ZoneState, WeatherKind, LineTripCause, GameOutcome, …
│   └── simulation-state.ts      SimulationState vocabulary (FSM state names)
│
├── constants/        @constants  Named constants — NO magic numbers live in engine code
│   ├── events.ts                GRID_EVENT registry + GridEventName union
│   └── simulation.ts            DEFAULT_TIMESTEP, NOMINAL_FREQUENCY, TRIP_THRESHOLD_PU, MAX_DEVICE_PIXEL_RATIO
│
├── utils/            @utils      Pure helpers only (assert.ts, math.ts) — no side effects
│
├── core/             @core       Kernel primitives + contracts. Imports NOTHING framework-y.
│   ├── errors/                  GridGuardError hierarchy + notImplemented()
│   ├── result/                  Result<T, E> discriminated union
│   ├── events/                  createEventBus + GridEventMap + EventMapIntegrity
│   ├── di/                      createContainer / createToken (tiny typed DI)
│   ├── clock/  rng/             Clock & Rng CONTRACTS (impls live in kernel)
│   ├── logging/                 Logger contract + NoopLogger
│   ├── serialization/           Serializer contract
│   ├── lifecycle/               SimulationSystem / SystemContext / TickContext / Disposable
│   └── tokens.ts                LOGGER, SERIALIZER, EVENT_BUS
│
├── kernel/           @kernel     The Simulation Kernel (real + tested). Domain-agnostic.
│   ├── time/                    createSimClock — fixed-timestep virtual clock
│   ├── rng/                     createMulberry32 — seeded deterministic PRNG
│   ├── scheduler/               createScheduler — steps systems in order each tick
│   ├── registry/                createSystemRegistry — insertion-ordered system store
│   ├── lifecycle/               createLifecycleManager — init/reset/dispose fan-out
│   ├── fsm/                     transitions.ts + createSimulationStateMachine
│   └── simulation-kernel.ts     createSimulationKernel + SIMULATION_KERNEL token
│
├── ethics/           @ethics     EIA snapshot, calibration, equity. UPSTREAM of engine.
│   ├── eia/  calibration/  equity/
│
├── engine/           @engine     System A. Owns authoritative GridState. Placeholders in Phase 1.
│   ├── model/grid.ts            GridTopology, GridState, LineFlow, ZoneStatus (data model)
│   ├── topology/  weather/  generation/  loads/       ordered subsystems …
│   ├── powerflow/  protection/  cascade/  restoration/  director/
│   └── simulation-engine.ts     SimulationEngine facade + SIMULATION_ENGINE token
│
├── scenarios/        @scenarios  Crisis plugins. Import engine; engine never imports them.
│   ├── crisis-scenario.ts       ICrisisScenario contract
│   ├── scenario-registry.ts     createScenarioRegistry + SCENARIO_REGISTRY
│   └── heatwave/                HeatwaveScenario (documented stub)
│
├── learning/         @learning   System B. Reads events only; never imports engine.
│   ├── twin/  knowledge-tracing/  concept-graph/  reference-policy/  scoring/  analytics/
│   └── learning-engine.ts       LearningEngine facade
│
├── replay/           @replay     First-class: record / play / verify. Deterministic backbone.
│   ├── recording/  playback/  serialization/  verification/  timeline/  snapshots/
│   └── model.ts                 RecordedEvent, Snapshot, ReplayRecording
│
├── state/            @state      Zustand projections — updated BY EVENTS ONLY (consumer layer)
│   ├── simulation-store.ts      useSimulationStore + bindSimulationStore
│   ├── learning-store.ts        useLearningStore + bindLearningStore
│   ├── ui-store.ts              useUiStore (UI-only state)
│   └── index.ts                 bindStores(bus) → combined detach
│
├── rendering/        @rendering  System C. PURE CONSUMER — never engine/kernel.
│   ├── scene-graph/             camera rig, lighting, world structure
│   ├── visual-effects/          particles, postFX, animation
│   └── render-root.tsx          RenderRoot (R3F Canvas host, later phase)
│
├── ui/               @ui         System D. HUD, panels, controls, accessibility.
│   ├── app-shell.tsx  hud/  decision-wheel/  timeline/  replay-controls/  settings/
│   ├── accessibility/           a11y helpers
│   └── foundation/              FoundationScreen (Phase-1 stand-in)
│
├── audio/            @audio      System E. audio-engine, adaptive-music, ambient, sfx, mixer
│
├── debug/            @debug      DebugOverlay + metrics collector (consumer)
├── config/           @config     Profiles: development / demo / production / competition
├── workers/          @workers    Stubbed sim-worker offload (bridge + message contracts)
├── infrastructure/   @infra      Composition root, bootstrap, console-logger, json-serializer
│   ├── di/composition-root.ts   The ONE place that binds every token → concrete impl
│   ├── bootstrap/bootstrap.ts   The initialization sequence → AppRuntime
│   ├── logging/console-logger.ts
│   └── serialization/json-serializer.ts
│
└── assets/           @assets     Static art / audio / model assets
```

## Folder responsibility, one line each

| Folder            | Single responsibility                                                                   |
| ----------------- | --------------------------------------------------------------------------------------- |
| `types/`          | Branded ids, physical units, enums, FSM state names. Imports nothing.                   |
| `constants/`      | Every named constant + the `GRID_EVENT` registry. No magic numbers elsewhere.           |
| `utils/`          | Pure, side-effect-free helpers (math, assertions).                                      |
| `core/`           | Contracts + primitives every layer builds on: event bus, DI, `Result`, errors, tokens.  |
| `kernel/`         | Deterministic time, seeded RNG, scheduler, registry, lifecycle, FSM — domain-agnostic.  |
| `ethics/`         | EIA snapshot / calibration / equity as pure data; consumed by the engine.               |
| `engine/`         | System A — the electrical model and physics subsystems; owns authoritative state.       |
| `scenarios/`      | Plugin crisis content behind `ICrisisScenario`; added without touching the engine core. |
| `learning/`       | System B — learner modeling and scoring, driven by observed events.                     |
| `replay/`         | Record, serialize, play back, and verify runs bit-for-bit.                              |
| `state/`          | Read-only Zustand projections rebuilt from events; the consumer read surface.           |
| `rendering/`      | System C — 3D scene graph and visual effects.                                           |
| `ui/`             | System D — DOM HUD, decision wheel, timeline, controls, accessibility.                  |
| `audio/`          | System E — adaptive music, ambient beds, SFX, mixing.                                   |
| `debug/`          | Developer overlay and runtime metrics.                                                  |
| `config/`         | Profile-scoped tunables; the only place hardcoded settings live.                        |
| `workers/`        | Contract for offloading the sim to a web worker (stubbed in Phase 1).                   |
| `infrastructure/` | Composition root + bootstrap; wires concrete impls. May import everything.              |
| `assets/`         | Static assets.                                                                          |

## `docs/` tree

```
docs/
├── architecture/                THIS folder — 15 numbered docs + renderer-purity + README (index)
├── design/                       Frozen visual doctrine (typography, color, motion, camera, …) [planned]
├── reference/                    Archived "Master Build Prompt" README [planned]
├── experience-doctrine.md        The five governing directives, duplicated for the whole team [planned]
├── competition-strategy.md       Judging strategy and acceptance lens [planned]
└── superpowers/specs/            Approved design specs (source of truth for this foundation)
```
