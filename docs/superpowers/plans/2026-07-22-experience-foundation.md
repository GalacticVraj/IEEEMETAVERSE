# Experience Foundation (§1+§2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ignite the already-tested simulation stack in the live app, then replace the prototype UI with a daylight mission-control learning console (CommandBar / OperatorActions / AssetInspector / Timeline / GridHealth / LearningFeedback / ScenarioPanel).

**Architecture:** All simulation fixes are wiring in `src/infrastructure` + edits to non-frozen orchestrator files (`simulation-engine.ts`, `director.ts`). UI reads exclusively from Zustand projections (`grid-store`, `simulation-store`, new `event-log-store`) and commits decisions via `DecisionCommitted` bus events. New UI lives in `src/ui/console/`.

**Tech Stack:** React 18 + TS strict, Zustand, R3F/three, Tailwind (tokens in `tailwind.config.js`), Vitest, Playwright (visual audit).

## Global Constraints

- FROZEN — never edit: `src/kernel/**`, `src/engine/graph/**`, `src/engine/powerflow/**`, `src/engine/protection/**` (engine internals), `src/scenarios/**` (framework + plugins), `src/replay/**`, `src/core/**` (except adding nothing — reuse existing events only).
- Modifiable engine-side: `src/engine/simulation-engine.ts`, `src/engine/director/director.ts`, `src/engine/model/grid.ts` (additive field only), `src/infrastructure/**`, `src/state/**`, `src/ui/**`, `src/rendering/**`, `src/App.tsx`.
- No `Math.random()` / `Date.now()` in anything that feeds simulation or logs.
- No emoji or icon fonts in new UI. Semantic colors only (`status.*` tokens). Mono for values, Inter for prose.
- All events consumed from the bus; no fake/simulated numbers in UI.
- Commit after every task. Never commit to `main`. Branch: `feature/experience-foundation`.
- Verification gate for the whole plan: `pnpm validate` green + Playwright audit script passes with zero console errors.

---

### Task 1: Playwright visual-audit harness + "before" baseline

**Files:**

- Create: `scripts/visual-audit.mjs`
- Output: `docs/superpowers/audit/before/*.png`, `docs/superpowers/audit/after/*.png`

**Interfaces:**

- Produces: CLI `node scripts/visual-audit.mjs --label=before [--url=http://localhost:5173]`. Screenshots each reachable app state; writes `console-errors.json` per run; exits non-zero if page errored on load.

Script behavior (complete):

1. Launch chromium (headed on Windows OK), viewport 1600×900.
2. Collect `console` messages of type error + `pageerror` into an array.
3. Goto url, wait for `canvas` element, wait 4 s (scene settle), screenshot `01-entry.png`.
4. Try (best-effort, wrapped in try/catch with 8 s timeouts — buttons may not exist before/after redesign): click text `Begin Shift` else `Enter`/`Start`; screenshot `02-console.png`. Click text `Record Heatwave` else first `[data-scenario]`; screenshot `03-scenario-selected.png`. Click `Start Scenario` if present. Wait 12 s of sim; screenshot `04-crisis-early.png`. Wait 30 s more; screenshot `05-crisis-late.png`.
5. Write `console-errors.json`; log PASS/FAIL (fail = any pageerror).

- [ ] Step 1: Write `scripts/visual-audit.mjs` as above (playwright is already a devDependency).
- [ ] Step 2: Start dev server in background; run `node scripts/visual-audit.mjs --label=before`. Expected: 01/02 captured (later steps may no-op on old UI), errors file written.
- [ ] Step 3: Commit `chore: playwright visual audit harness + before baseline`.

### Task 2: Topology→graph builder (TDD)

**Files:**

- Create: `src/engine/topology/graph-builder.ts`
- Test: `src/engine/topology/graph-builder.test.ts`

**Interfaces:**

- Consumes: `ElectricalGraph.mutate` (`src/engine/graph/electrical-graph.ts:127`), specs from `src/engine/graph/entities/electrical-entities.ts` (`BusSpec{id,nominalVoltageKv}`, `TransmissionLineSpec{id,from,to,capacityMw,reactancePu}`, `GeneratorSpec{id,busId,capacityMw,generationKind}`, `LoadSpec{id,busId,nominalDemandMw,critical}`), `GridTopology` from `src/engine/model/grid.ts`.
- Produces: `populateGraphFromTopology(graph: ElectricalGraph, topology: GridTopology): MutationResult` — one transaction; buses first, then lines, generators, loads. Bus metadata carries `{ zone }`. IDs cast via `as unknown as BusId` etc. (topology `NodeId` ≠ graph `BusId` brands). `nominalVoltageKv: 230` for all buses.

- [ ] Step 1: Write failing test: fresh `createElectricalGraph({})` + `populateGraphFromTopology(graph, MERIDIAN_BAY_TOPOLOGY)` → `graph.buses().length===20`, `lines().length===30`, `generators().length===8`, `loads().length===18`, `graph.validate().errorCount===0`, `graph.islandCount()===1`.
- [ ] Step 2: `pnpm vitest run src/engine/topology/graph-builder.test.ts` → FAIL (module missing).
- [ ] Step 3: Implement builder. Step 4: test PASS. Step 5: Commit `feat: graph builder populates ElectricalGraph from Meridian Bay topology`.

### Task 3: Ignition — register engine, populate graph, protection on bus, tick dedupe, LineTripped bridge

**Files:**

- Modify: `src/infrastructure/bootstrap/bootstrap.ts` (populate graph + `kernel.register(engine)` BEFORE `kernel.boot()`)
- Modify: `src/infrastructure/di/composition-root.ts:150` (`createProtectionEngine({ events: c.resolve(EVENT_BUS) as unknown as TypedEventBus<ProtectionEventMap> })`)
- Modify: `src/engine/simulation-engine.ts` — (a) DELETE the `SimulationTick` emit at end of `step()` (kernel emits the authoritative one after all systems step, `simulation-kernel.ts:166`); (b) after `this.protection.evaluate(...)` capture its `ProtectionCycleResult` and for each `opened` line emit `GRID_EVENT.LineTripped` with `cause: LineTripCause.Overload` when `this.protection.relayFor(line)?.lastTripTick != null` else `LineTripCause.Operator`; keep everything else identical.
- Modify: `src/infrastructure/bootstrap/bootstrap.test.ts` — extend.

**Interfaces:**

- Consumes: Task 2 builder; `SimulationKernel.register` (must be called in `Boot` state, `simulation-kernel.ts:187-194`); `GRID_EVENT.LineTripped` payload `{line: LineId, cause: LineTripCause}` (`src/core/events/grid-events.ts:63`).
- Produces: after `bootstrap(config)`, `kernel.tick()` runs the full physics pipeline; `LineTripped`/`LineRecovered` flow on the bus (feeding `cascade.ts`, `grid-store.ts:63`); exactly ONE `SimulationTick` per tick.

- [ ] Step 1: Extend bootstrap.test: after bootstrap, `kernel.start(); kernel.tick();` → `engine.getState().lines.length === 30` and `totalGeneration > 0`. Run → FAIL (empty state).
- [ ] Step 2: Implement the four edits. Step 3: test PASS; full `pnpm test` PASS (existing simulation-engine.test constructs engine directly — verify no double-tick assumptions break; fix test expectations if they asserted the engine's own SimulationTick emit).
- [ ] Step 4: Commit `feat: ignite simulation — engine registered, graph populated, protection bridged`.

### Task 4: Crisis session (tick driver + scenario activation + outcomes)

**Files:**

- Create: `src/infrastructure/runtime/crisis-session.ts` + `crisis-session.test.ts`
- Modify: `src/infrastructure/bootstrap/bootstrap.ts` (create session, expose on `AppRuntime`)
- Modify: `src/engine/director/director.ts` (emit `GameEnded` on blackout conditions)
- Modify: `src/state/app-flow-store.ts` (add `bindAppFlow(bus, session)`; realign `CRISIS_CARDS`)
- Modify: `src/main.tsx` (call `bindAppFlow`)

**Interfaces:**

- Produces: `interface CrisisSession { start(id: string): void; pause(): void; resume(): void; stop(): void; readonly running: boolean; readonly activeScenarioId: string | null }`, `createCrisisSession(deps: { kernel; registry: () => ScenarioRegistry; maxTicks?: number; tickIntervalMs?: number })`. `AppRuntime.session: CrisisSession`.
- `start(id)`: teardown previous scenario → `kernel.reset()` (kernel API `reset()` exists, keeps lifecycle) → `engine` systems reset via kernel lifecycle → resolve registry lazily, `registry().get(asScenarioId(id))` → `kernel.start()` (Idle→Running; resume/pause guards) → `setInterval(100ms)`: `kernel.tick()` then `scenario.onTick({tick: kernel.clock.tick, time: kernel.clock.time, timestep: kernel.clock.timestep})`; at `tick >= maxTicks(default 1800)` emit `GRID_EVENT.GameEnded {outcome: GameOutcome.Held, score: 100}` once and `stop()`.
- Director: track consecutive blackout ticks; emit `GameEnded {outcome: SystemBlackout, score: 0}` when ≥2 zones Blackout, or `{outcome: PartialBlackout, score: 40}` when ≥1 zone Blackout for 150 consecutive ticks. Single-fire guard reset in `reset()`.
- `bindAppFlow(bus, session)`: `bus.on(GRID_EVENT.GameEnded, p => { session.stop(); useAppFlowStore.getState().resolveCrisis(p.outcome === 'Held' ? 'success' : 'blackout'); })`. `selectCrisis(id)` now also calls `session.start(id)` (inject session via `bindAppFlow` storing a module-level ref, or pass runtime into ScenarioPanel — choose: ScenarioPanel calls `runtime.session.start(id)` then `selectCrisis(id)`; keep store pure).
- `CRISIS_CARDS` → ids `heatwave` / `storm` / `equipment-failure` (real registry ids), no `icon` field, descriptions from each scenario's `metadata.summary`.

- [ ] Step 1: crisis-session.test with `vi.useFakeTimers()` + real bootstrap(test profile): `session.start('heatwave')`, advance 1000 ms → grid tick 10; advance to tick 61 → `G-BASE-S` trip visible (`engine.getState().totalGeneration` drops); `GameEnded` fires by maxTicks with fake timers advanced fully. Run → FAIL.
- [ ] Step 2: Implement session + director + bindAppFlow. Step 3: PASS + `pnpm test` green. Step 4: Commit `feat: crisis session drives kernel ticks, activates scenarios, resolves outcomes`.

### Task 5: Design tokens — daylight console

**Files:**

- Modify: `tailwind.config.js` — same token NAMES, daylight values: `surface.void:#DDE3E8` (3D clear fallback), `surface.base:#EEF0EF`, `surface.panel:#FAFAF7`, `surface.raised:#FFFFFF`, `surface.border:#D3D7D2`; `ink.primary:#1C2530`, `ink.secondary:#5A6774`, `ink.muted:#8B97A3`, `ink.inverse:#FAFAF7`; `status.nominal:#217A56`, `status.caution:#9A6B15`, `status.warning:#B4531F`, `status.critical:#B3261E`, `status.offline:#5F6B76`, add `status.recovery:#217A56`; `instrument.DEFAULT:#22637E`, `instrument.dim:#7FA6B8`. Update header comment (doctrine v2: daylight digital twin, mission-control overlay; glassmorphism/neon still forbidden).
- Rewrite: `src/index.css` — keep `@tailwind` directives + reset + `html,body,#root` (bg `#EEF0EF`, color ink.primary); NEW primitives: `.console-panel` (bg panel, 1px border, radius 4px, subtle 0 1px 2px rgba shadow), `.console-section-title` (11px, uppercase, tracking .08em, ink.secondary, mono), `.console-value` (mono, tabular-nums), `.console-btn` / `.console-btn-primary` (radius 2px, 1px border, no gradients), `.status-led` (8px square). LEGACY ALIASES restyled (so still-mounted old screens degrade professionally): `.glass-panel`/`.glass-panel-solid` → solid `surface.panel` + border, NO blur, radius 4px; `.btn-moss` → `.console-btn-primary` look; `.btn-outline` → `.console-btn` look. Keep `fadeIn`/`slideDown` keyframes; delete `pulse-glow`, liquid-glass.
- Modify: `index.html` — add Google Fonts `JetBrains Mono:400;600`; keep Inter; drop Instrument Serif; `<title>GridGuard — Meridian Bay Grid Operations</title>`; body bg `#EEF0EF`.

- [ ] Step 1: Apply all three files. Step 2: `pnpm dev` visual check — old screens now flat/neutral, no blur. Step 3: Commit `feat: daylight console design tokens + primitives`.

### Task 6: Projections — richer GridState + event log store + selection store

**Files:**

- Modify: `src/engine/model/grid.ts` — add to `GridState`: `readonly renewableGeneration: MegaWatts; readonly generators: readonly GeneratorStatus[];` with `export interface GeneratorStatus { readonly id: GeneratorId; readonly outputMw: MegaWatts; readonly capacityMw: MegaWatts; readonly tripped: boolean; }`
- Modify: `src/engine/simulation-engine.ts` `step()` — build `generators` from `topology.generators` via `this.generation.getGeneratorOutput(id)` / `isTripped(id)`; `renewableGeneration` = sum of outputs where `kind` ∈ {Solar, Wind, Storage}; include both in `this.state`; `_initializeState()` gets `renewableGeneration: asMegaWatts(0), generators: []`.
- Modify: `src/state/grid-store.ts` — copy `zones`, `renewableGeneration`, `generators` into projection (add fields to `GridProjection`, initial empty).
- Create: `src/state/event-log-store.ts` + register in `src/state/index.ts` `bindStores`.
- Modify: `src/state/ui-store.ts` — add `selectedAsset: {kind:'line'|'bus'|'generator'|'building'; id:string} | null` + `selectAsset(asset)` action.

**Interfaces:**

- Produces: `useEventLogStore` — `entries: readonly EventLogEntry[]` where `EventLogEntry = {seq:number; tick:number; severity:'info'|'caution'|'warning'|'critical'|'recovery'; title:string; detail:string}`; `bindEventLog(bus): Unsubscribe` subscribing: `WeatherChanged` (log only when `kind` changes), `LineTripped`, `LineRecovered`, `CascadeStarted/CascadeEnded`, `ZoneBlackout`/`ZonePowered` (log only on per-zone STATE CHANGE — keep a `Map<zone,state>`), `DecisionRequested/DecisionCommitted`, `GameEnded`. Ring buffer 200. Titles/details from `learning-copy.ts` (Task 7).
- Tests: `event-log-store.test.ts` — emit synthetic events on a bare `createSimulationKernel().events` bus, assert dedupe (two consecutive ZonePowered same zone → 1 entry) and ordering.

- [ ] Step 1: failing store test → implement → PASS. Step 2: engine additions; `pnpm test` green (update any GridState literals in existing tests). Step 3: Commit `feat: event log + selection projections, per-generator grid state`.

### Task 7: Learning copy + AssetInspector + 3D selection

**Files:**

- Create: `src/ui/console/learning-copy.ts` — zone display names/populations-served estimate (derived: `≈800 households per residential MW` constant, labeled estimate), per-event copy `{title, what, why, action}`, line/generator/bus explanation builders (input: live projection values → plain-language cause/impact sentences), building teaching notes keyed by building id prefix (reuse strings from current `city-layout.tsx` inspect data).
- Create: `src/ui/console/AssetInspector.tsx`
- Modify: `src/rendering/grid-scene.tsx` — `onClick` on line cylinders → `selectAsset({kind:'line',id})`; bus markers → `bus`; generator groups → `generator`; `GeneratorMarkers` reads `useGridStore(s=>s.generators)` for `tripped` (stop rotor, `status.offline` material) — removes the hardcoded `isTripped={false}`.
- Modify: `src/rendering/city-layout.tsx` — building click handlers → `selectAsset({kind:'building',id})` ONLY (delete `runtime.container.resolve(LOAD_MODEL)`, `kernel.events.emit`, `Date.now()` — the renderer→engine violations); zone blackout dimming: read `useGridStore(s=>s.zones)`; when a building's zone is `Blackout` pass `dimmed` prop → buildings render emissiveIntensity 0 + darkened color.

**Interfaces:**

- AssetInspector reads `useUiStore.selectedAsset` + `useGridStore` (lines/zones/generators) + `MERIDIAN_BAY_TOPOLOGY` (static reference only). Sections: identity (mono id + role), status LED + label, live metrics rows (line: flow MW / loading % / relay state from `LineFlow.state`; generator: output/capacity/tripped; bus: zone, powered (zone state), connected lines; building: zone, priority tier, teaching note), cause (learning copy), impact (zones served — static topology adjacency), recommended action. Close button clears selection.

- [ ] Step 1: Implement copy module + inspector + scene selection edits. Step 2: manual check in dev (click line → panel shows real loading matching legend color). Step 3: `pnpm typecheck && pnpm lint` clean. Step 4: Commit `feat: asset inspector with live telemetry + learning explanations; renderer purity fixes`.

### Task 8: CommandBar, GridHealthPanel, ScenarioPanel, OperatorActionsPanel, Timeline, LearningFeedback, ConsoleShell

**Files:**

- Create in `src/ui/console/`: `ConsoleShell.tsx`, `CommandBar.tsx`, `GridHealthPanel.tsx`, `ScenarioPanel.tsx`, `OperatorActionsPanel.tsx`, `Timeline.tsx`, `LearningFeedback.tsx`, `operator-actions.ts` (action catalog)
- Modify: `src/engine/simulation-engine.ts` `DecisionCommitted` handler — add `op-*` decision ids (see catalog).

**Interfaces & content:**

- `ConsoleShell` grid: `grid-template-rows: 48px 1fr 176px; grid-template-columns: 300px 1fr 320px;` — top bar spans all columns; left = GridHealthPanel + (mode CrisisSelect ? ScenarioPanel : OperatorActionsPanel); center = transparent (pointer-events none except children); right = AssetInspector (+LearningFeedback stacked below); bottom spans = Timeline. Panels `pointer-events:auto`; center hole keeps 3D interactive. Max-width scaling for presentation mode: root font-size bump at ≥2200px viewport via media query.
- `CommandBar`: left `GRIDGUARD · MERIDIAN BAY OPERATIONS` (mono 12px) · scenario name · center: sim clock `T+mm:ss` (tick/10) + day-phase label (tick→morning/afternoon/evening/night mapping constant) · right: stability chip (label from `maxLineLoading` + `trippedCount` + blackout zones: NORMAL / ELEVATED / EMERGENCY / BLACKOUT — display mapping only), pause/resume (`runtime.session`), `End Shift` (→ stop + resolveCrisis) in ActiveCrisis; `STANDBY` state otherwise.
- `GridHealthPanel` rows (all from grid-store): Demand MW, Generation MW, Balance (signed, semantic color), Frequency Hz, Renewables % (`renewableGeneration/totalGeneration`), Corridor stress (max loading %), Zones dark (count + est. residents affected via copy helper). Each row: label + mono value + one-line meaning (`ink.muted`, from learning-copy).
- `ScenarioPanel`: 3 cards from `CRISIS_CARDS` (name, difficulty, summary, `data-scenario` attr); select → highlight; `Start Scenario` button → `runtime.session.start(id)` + `selectCrisis(id)`.
- `operator-actions.ts` catalog (5 actions, each `{id, label, plainEffect, cost, benefit, risk, decisionId}`): `op-ac-residential` (Reduce residential AC — RN+RS `ac` off), `op-ev-pause` (Pause public EV charging — all zones `ev` off), `op-lights-commercial` (Dim commercial lighting — DT `lights` off), `op-shed-industrial` (Controlled industrial shed — `LD-IN-HVY`/`LD-IN-LGT` 30%), `op-shed-harbor` (Emergency harbor shed — `LD-HB-IND` 25%, `LD-HB-SHIP` 25%). Engine handler maps each id to the corresponding `loads.toggleAppliance`/`shedLoad` calls (extend existing `DecisionCommitted` listener pattern, `simulation-engine.ts:67`).
- `OperatorActionsPanel`: director prompts first (from `useSimulationStore.activeDecision`: prompt + option buttons → `bus emit DecisionCommitted {decisionId, optionIndex, simTime}` via a thin `commitDecision(runtime, ...)` helper that also `logDecision` with REAL tick + current `maxLineLoading`), then the 5 standing actions as rows (label, effect line, Cost/Benefit/Risk micro-rows, `Execute` button → emits `DecisionCommitted {decisionId: asDecisionId('op-…-'+tick), optionIndex: 0}`); executed actions show `COMMITTED · T+…` and disable.
- `Timeline`: bottom panel: left = transport (pause/resume, Restart Run → `session.start(activeScenarioId)`), sim clock; center = horizontal tick ruler with event markers (colored by severity, clustered), rendered from `useEventLogStore`; right = scrolling event stream (latest 8 visible, `[T+mm:ss] TITLE — detail`), click entry → shows its learning copy in LearningFeedback.
- `LearningFeedback`: renders the most recent `warning|critical` entry (or clicked entry): three labeled rows — WHAT HAPPENED / WHY / WHAT YOU CAN DO (from learning copy), dismiss button. One card, no toasts.

- [ ] Step 1: Implement catalog + engine handler; test: engine unit test emits `op-ac-residential` commit → residential AC appliances off (extend `simulation-engine.test.ts`). PASS.
- [ ] Step 2: Implement all components + shell (visual iteration in dev).
- [ ] Step 3: Commit `feat: mission-control console UI (§2 structure)`.

### Task 9: App re-parenting + flow compression

**Files:**

- Modify: `src/App.tsx` — Hero: keep persistent Canvas + `AutoOrbitCamera`; new minimal `HeroOverlay` (restyle in place: title, one-line mission framing, `Begin Shift` → `enterSimulation()`); REMOVE mounts of `ArrivalCamera`, `DroneCamera`, `AdvisorDrone`, `ArrivalOverlay`, `ExploreHud`, `CrisisSelectScreen`, `OperatorPanel` (files stay, unmounted); CrisisSelect/ActiveCrisis/AfterAction render `<ConsoleShell mode={mode}/>`; AfterAction keeps existing `AfterActionScreen` layered above shell; add `<OrbitControls enablePan={false} minPolarAngle={0.35} maxPolarAngle={1.25} minDistance={80} maxDistance={420} dampingFactor={0.08} enableDamping />` for console modes (stable operator camera; §3 delivers the full camera system).
- Modify: `src/ui/hero/HeroOverlay.tsx` — console-style minimal (no glass, no marketing type scale, no dead nav links).
- Modify: `src/state/app-flow-store.ts` — `enterSimulation()` reachable from Hero; `Arrival/Explore/Briefing` enum values remain (unused) so no store consumers break.
- Lighting: in App.tsx replace golden-hour rig with neutral daylight (ambient `#F5F7FA` 0.45, directional `#FFF4E0` 1.6 from [80,140,60], hemisphere light sky `#CBD9E6` ground `#B8B2A6` 0.5); remove green/orange point lights; keep Bloom but `luminanceThreshold: 0.75, opacity: 0.35` (subtle).

- [ ] Step 1: Implement; verify all 4 reachable modes render; old smoke test `src/App.smoke.test.tsx` updated to the new flow (Hero → CrisisSelect via `enterSimulation`).
- [ ] Step 2: `pnpm validate` green.
- [ ] Step 3: Commit `feat: compressed ops flow — hero to console; daylight scene lighting`.

### Task 10: Full validation + after screenshots + deliverable

- [ ] Step 1: `pnpm validate` → all green (typecheck, engine typecheck, lint, ~330 tests).
- [ ] Step 2: Dev server + `node scripts/visual-audit.mjs --label=after` — full flow now scriptable; verify screenshots show: live line loadings changing, event stream filling at tick 60 (baseload trip), stability chip escalation, blackout dimming if reached; `console-errors.json` empty.
- [ ] Step 3: I (Claude) visually inspect before/after PNGs and fix anything cartoonish/broken; re-run audit.
- [ ] Step 4: Commit `test: after-state visual audit evidence`.
- [ ] Step 5: Report deliverable in chat: UI architecture, component structure, UX decisions, before/after, localhost instructions, remaining §3 opportunities.

## Self-review notes

- Spec coverage: §2 items 1–9 map to Tasks 5–9; validation block → Tasks 1, 10; §1b sim ignition → Tasks 2–4. Responsive/presentation mode → ConsoleShell media query (Task 8). "No sim logic in UI": win/lose now director/session (Task 4); tick loop in session (Task 4); stability chip is display mapping only (documented).
- Type consistency: `GeneratorStatus`, `EventLogEntry`, `CrisisSession`, `selectAsset` shapes defined once above; all consumers reference those exact names.
- Known deviation: `AfterActionScreen` retains its mocked advisor (explicitly out of §2 scope; §3+).
