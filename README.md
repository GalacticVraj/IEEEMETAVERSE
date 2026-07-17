# GRIDGUARD — MASTER BUILD PROMPT (Claude Code Edition)
### "Learning Through Consequence" — An Immersive 3D Energy-Crisis Simulator
**Paste this entire document into Claude Code as your build instruction. It is written as a direct, imperative specification — execute it phase by phase.**

---

## 0. HOW TO USE THIS DOCUMENT

This is not a feature list — it is a full production brief. Build GridGuard as a **real 3D interactive city simulation**, not a dashboard with a map graphic. The player stands inside a living city, watches its lights breathe with the grid's load, and makes decisions that visibly, physically change the world around them. Think **Cities: Skylines' spatial readability** crossed with **a battle-royale HUD's tension and pacing** — countdown timers, zone alerts, a floating AI companion, adaptive music that escalates with danger — applied to a subject nobody has ever made feel urgent: the power grid.

Build in **phases, in order**. Do not skip ahead. Each phase must run and look correct before the next begins. At the end of every phase, run the app, take a screenshot mentally (or literally, via the browser), and confirm the acceptance criteria before proceeding.

---

## 1. THE FANTASY — WHAT THE PLAYER FEELS

The player is dropped into **Meridian Bay**, a mid-size coastal city, in the role of **Grid Operator, Shift One**, on the day a record heatwave hits. They are not reading about a grid — they are standing over one, watching a live 3D skyline where every window's glow is real telemetry. A countdown ticks. An AI advisor drone hovers nearby, calm at first, urgent later. As the player intervenes — cutting AC to a commercial block, activating solar reserves, delaying EV charging — the city visibly responds: lights dim or steady, a transformer sparks and a block goes dark, sirens wail over a hospital that must never lose power. When they get it wrong, the consequence is not a red error toast — it is **a blackout rolling across the skyline in real time, audible, visible, felt**. When they get it right, the city holds, the music resolves, and a scoreboard proves — with real numbers — that they understood something they didn't five minutes ago.

**Core pillars (every system you build must serve at least one of these):**
1. **Causality is visible** — every number changes something you can see, not just a UI label.
2. **Tension is paced like a game, not a form** — countdowns, escalating music, camera drama, not static panels.
3. **Consequence is felt, not told** — a blackout is a cinematic event, not a state flag.
4. **The city is real** — real EIA energy data grounds the simulation and the ethics narrative.
5. **Mastery is measurable** — the Learner Digital Twin proves improvement with numbers, every run.

---

## 2. TECH STACK (browser-native — no engine install, no asset pipeline, ships as a URL)

Unity/Unreal are explicitly out of scope: they cost build time you don't have and add a hardware/install dependency judges won't tolerate. Instead, hit AAA-adjacent *feel* entirely in-browser using modern WebGL post-processing and procedural generation — zero external 3D assets required, so there is no art-sourcing bottleneck.

| Layer | Library | Purpose |
|---|---|---|
| App shell | Vite + React 18 + TypeScript | fast iteration, typed data contracts across systems |
| 3D renderer | `three`, `@react-three/fiber` | scene graph, camera, lighting, instanced meshes |
| 3D helpers | `@react-three/drei` | OrbitControls, `<Html>` world-anchored UI, Sky, Environment, Text3D |
| Post-processing | `@react-three/postprocessing` (Bloom, DepthOfField, ChromaticAberration, Vignette, Noise, SSAO/N8AO, ToneMapping) | the single biggest lever for "AAA feel" per line of code |
| Physics (light) | `@react-three/rapier` | optional debris/particle physics on transformer failure |
| Global state | `zustand` | GridState, LearnerTwin, UI state — single source of truth |
| Animation/camera | `gsap` + `@gsap/three` | cinematic camera tweens, HUD entrance/exit, hit-stop |
| Audio | `howler.js` | layered adaptive music, crossfaded by tension level |
| Validation | `zod` | schema-validate every AI advisor response before render |
| HUD/UI | Tailwind CSS, absolute-positioned DOM over the canvas | crisp 2D UI layered on top of the WebGL scene |
| AI advisor | Gemini API (or equivalent LLM endpoint) | live reasoning over grid + twin state |
| Real data | EIA Open Data API v2, fetched once at build time and cached as static JSON | grounds System D, zero runtime dependency during demo |
| Charts | `recharts` | before/after Learner Twin evidence for the deck |
| Hosting | Vercel | continuous deploy from commit 1 |

Do not add a backend, database, or auth system. All state is client-side and in-memory for the session — this is a design decision (see Section 11, Privacy), not a shortcut.

---

## 3. THE WORLD — MERIDIAN BAY

### 3.1 Layout
Generate the city **procedurally in code** — no external GLTF files needed. A 7×7 block grid, road network on integer coordinates, six zones assigned to contiguous block clusters:

```
NW: Residential (low-income)      N:  Hospital (critical load, never sheds)
NE: Residential (high-income)     C:  Downtown Commercial (high-rise cluster)
W:  School                        E:  Industrial
S:  Solar Farm (visible panel field, generation source)
```

Each block is an `InstancedMesh` of extruded box "buildings" with randomized height/footprint per zone type (downtown = tall, residential = short, industrial = long low sheds). Roads are a flat plane with an emissive centerline strip. Streetlights and low-poly trees (cone + cylinder primitives) are separate `InstancedMesh` groups for performance.

### 3.2 The Load-Reactive Material System (this is the core visual hook)
Every building has a **window emissive layer** driven directly by simulation state — this is what makes the city feel alive and turns telemetry into spectacle:

```ts
// Per-frame (or per-tick), for each building in a zone:
windowEmissiveIntensity = lerp(0.15, 2.4, zone.currentLoad / zone.capacity)
windowColor = loadToColor(zone.currentLoad / zone.capacity)
// 0–0.6  → warm white  (#fff2d0)   normal
// 0.6–0.85 → amber      (#ffb020)   warning
// 0.85–1.0 → red pulse  (#ff3b30)   critical, intensity oscillates via sine(time*6)
// blackout → emissive → 0.02, all windows go near-dark except emergency strobe on hospital
```

On **blackout trigger** for a zone: animate emissive intensity to near-zero over 400ms (gsap), spawn a **spark particle burst + smoke puff** at that block's transformer prop, kill the streetlights in that block, and if it's the hospital zone, activate a looping red beacon light + siren SFX — hospitals must be dramatized as the one zone that must never go fully dark.

### 3.3 Camera & Controls
- **Cinematic open**: on load, a scripted gsap camera flythrough — starts high above the bay, swoops down over downtown, settles into the default operator view (~2.5s, skippable on click).
- **Default view**: isometric-ish orbit camera (drei `OrbitControls`, polar angle clamped 35–65°, zoom clamped) — readable like a strategy game, not disorienting.
- **Building interaction**: raycast from mouse/pointer; hover = subtle emissive outline pulse + cursor change; click = open the **Decision Wheel** (Section 5.2).
- **Crisis camera beats**: on a blackout trigger, gsap-tween the camera to briefly push in toward the affected block (~600ms) before returning to the operator view — this is the single most important "juice" moment in the whole build; do not skip it.
- **Mobile**: touch-drag orbit, pinch zoom, tap-to-select identical to click.

### 3.4 Atmosphere
- Heatwave sky: warm-shifted `<Sky>` (drei), sun low and orange, subtle bloom bleed.
- Heat-haze: a full-screen shader plane with sine-wave UV distortion, opacity driven by `avgTemperature` — barely visible at baseline, clearly wobbling at peak heatwave.
- Ambient dust motes: a slow, sparse `Points` particle field with soft round sprites, additive blending.
- Day-for-night option: at blackout, globally desaturate the scene 30% and drop ambient light intensity — visually distinct from "just dim."

---

## 4. THE FOUR CORE SYSTEMS (build these as isolated, testable modules)

The simulation is exactly four systems. Everything in Section 3 and 5 is presentation wrapped around these four. Do not add a fifth. Freeze this architecture before writing UI code.

### 4.1 System A — Scenario & Simulation Engine

```ts
interface Zone {
  id: string; type: 'residential_low' | 'residential_high' | 'hospital' | 'school' | 'commercial' | 'industrial';
  incomeTier: 'low' | 'mid' | 'high';
  baseLoad: number; currentLoad: number; capacity: number;
  solarBackupFactor: number;      // 0–1, from System D calibration
  recoveryMultiplier: number;     // from System D calibration
  state: 'normal' | 'warning' | 'critical' | 'blackout';
  criticalZone: boolean;          // hospital = true, never allow full shed
}

interface GridState {
  tick: number; timestamp: number;
  zones: Zone[]; totalLoad: number; totalCapacity: number;
  weather: { temperature: number; solarIrradiance: number; event: 'none'|'heatwave'|'price_spike'|'demand_surge' };
}

function calculateGridLoad(zone: Zone, env: {temperature: number}, calib: Calibration): number {
  const ac_term   = env.temperature * zone.acUsage * TEMP_LOAD_COEFF;
  const ev_term   = zone.evChargingLoad;
  const solar     = zone.solarGeneration * zone.solarBackupFactor;
  return zone.baseLoad + ac_term + ev_term - solar;
}

function tick(state: GridState, calib: Calibration): GridState {
  const temperature = state.weather.temperature + randomNormal(0, 2);      // Monte Carlo layer
  const solarOut     = state.weather.solarIrradiance * randomNormal(1, 0.1);
  for (const zone of state.zones) {
    zone.currentLoad = calculateGridLoad(zone, { temperature }, calib);
    const ratio = zone.currentLoad / (zone.capacity * zone.recoveryMultiplier);
    zone.state = ratio > 1 ? 'blackout' : ratio > 0.85 ? 'critical' : ratio > 0.6 ? 'warning' : 'normal';
    if (zone.state === 'blackout' && !zone.criticalZone) triggerBlackout(zone);
    if (zone.state === 'blackout' && zone.criticalZone) triggerEmergencyPower(zone); // hospital: draws from reserve, never fully dark
  }
  return state;
}
```

`randomNormal(mean, stdDev)` (Box–Muller transform) is the **only** source of randomness — applied to temperature and solar irradiance each tick. This is a legitimate Monte Carlo method; keep it that simple and auditable.

Crisis events are authored, not random: `heatwave` (temperature ramps over 90s), `price_spike` (capacity effectively shrinks — frame as "brownout pressure"), `demand_surge` (EV/AC load spikes suddenly across 2–3 random zones). Trigger one per playthrough at a scripted moment (see Section 6, Game Loop), with Monte Carlo variance layered on top so no two runs feel identical.

### 4.2 System B — Learner Digital Twin

```ts
interface LearnerTwin {
  learnerId: string; attempt: number;
  decisionsMade: number; correctTradeoffDecisions: number;
  blackoutsCaused: number; zonesSaved: number;
  avgDecisionTimeSec: number;
  understandingScore: number;          // 0–1, weighted composite
  weakConceptTags: string[];           // e.g. "solar_intermittency", "critical_load_priority"
  equityAwarenessScore: number;        // written by System D — see 4.4
  decisionLog: DecisionLogEntry[];     // full timeline, drives the after-action replay (Section 8)
}
```

Not a 3D avatar — a pure data model. Instrument every single decision with a start/stop timer. This object is the entire proof of the 25%-weighted "Effectiveness of Learning" criterion: it must be shown, not claimed, both mid-session (a live HUD widget) and in the after-action report (Section 8).

### 4.3 System C — AI Advisor Agent

Represent the advisor **in-world** as a floating holographic drone (an emissive low-poly sphere with an orbiting ring, gentle idle bob via a sine offset in `useFrame`) anchored near the operator's view, its dialogue rendered via drei's `<Html>` as a world-anchored chat bubble so it reads as a character, not a chatbot widget.

```ts
interface AdvisorRequest {
  gridState: { zoneAtRisk: string; loadPct: number; minutesToBlackout: number };
  twinState: { blackoutsCaused: number; avgDecisionTimeSec: number };
  eventContext: string;
}
interface AdvisorResponse {
  suggestion: string; reason: string; confidence: number;
  tone: 'supportive' | 'neutral' | 'urgent';
  highlightZoneId?: string;   // drives an in-world beacon light column on the recommended zone
}
```

Behavior rules:
- Every request carries **full current context** — never a canned prompt.
- On `tone: 'urgent'`, the drone's ring spins faster, its emissive shifts red, and the chat bubble types in with a faster character-reveal animation (juice matters here too).
- `highlightZoneId` spawns a vertical light-column beacon (a thin additive-blended cylinder shooting into the sky) over the recommended building so the suggestion is spatial, not just textual.
- **Fallback contract**: every call wrapped in a 2.5s timeout + try/catch. On failure, render a deterministic static suggestion keyed to `zoneAtRisk` — the drone must never sit silent or block the UI thread.

### 4.4 System D — Ethics, Equity & Real-Data Calibration Layer (EIA-grounded)

This is a first-class system, architecturally equal to A/B/C — not an afterthought screen. It grounds both simulation parameters and the ethics narrative in real public data.

**Data source**: U.S. Energy Information Administration Open Data API v2 (`api.eia.gov`, docs at `eia.gov/opendata`). Pull once at build time: state/region average retail electricity price (¢/kWh), renewable generation share, regional peak demand. Cache as a static JSON bundled with the app — do not call this API live during a judged demo. Verify exact route/facet parameters against current API v2 docs at integration time; series identifiers are revised periodically.

```ts
interface EIACalibrationRecord {
  regionId: string; avgRetailPriceCentsPerKwh: number;
  renewableSharePct: number; peakDemandMw: number; sourceYear: number;
}

function calibrateZone(zone: Zone, eia: EIACalibrationRecord, baseline: EIACalibrationRecord): Zone {
  const priceRatio = eia.avgRetailPriceCentsPerKwh / baseline.avgRetailPriceCentsPerKwh;
  zone.recoveryMultiplier = clamp(priceRatio, 0.7, 1.4);   // higher real price → slower simulated recovery
  zone.solarBackupFactor  = eia.renewableSharePct / 100;
  return zone;
}

function computeEquityDelta(zones: Zone[]): number {
  return variance(zones.map(z => z.recoveryMultiplier));  // higher variance = larger real-world disparity
}
```

**In-world manifestation** (this is what makes it a system, not a slide): an **Equity Overlay** toggle (a HUD button, styled like a mini-map layer switch) that recolors the entire city by `incomeTier` × `recoveryMultiplier` as a heatmap wash over the buildings — low-income zones with high recovery multipliers glow a visible warning tint. A physical **Data Terminal** structure (a holographic kiosk prop placed downtown) opens the full Ethics & Data panel on click:

| Panel | Basis |
|---|---|
| Data transparency | Static: no personal data stored; session-only, cleared on tab close |
| Equity insight | **Dynamic** — renders `computeEquityDelta()` against the live calibration, e.g. "Zones calibrated at a 1.3× recovery multiplier reflect real regional price disparity, not a scripted penalty" |
| AI reliability | Static: advisor output is guidance, the learner holds final authority |

`equityAwarenessScore` on the Learner Twin increments whenever a player action affects a low-income/low-solar zone — this is the wire that connects System D back into System B, so the four systems form one loop instead of three systems plus a bolted-on screen.

---

## 5. GAME-FEEL SYSTEMS ("the 10% that makes it feel like a game")

### 5.1 Adaptive Music (Howler.js, layered, crossfaded — do not use a single looping track)

| Layer | Trigger | Description |
|---|---|---|
| `ambient_pad` | always playing, volume 1.0 | sparse synth pad, slow filter sweep, sets tone |
| `tension_perc` | fades in as `totalLoad/totalCapacity` crosses 0.7 | sparse percussion, rising |
| `crisis_theme` | fades in on any zone hitting `critical` | driving synth/orchestral hybrid, replaces perc layer |
| `blackout_hit` | one-shot on blackout trigger | a single sub-bass hit + distorted alarm stab, not looped |
| `resolution_sting` | one-shot when the crisis event ends with zero net blackouts | short triumphant swell |

Crossfade layers over 800ms on state change (Howler `fade()`), never hard-cut. This single system does more for perceived production value than any visual effect — build it early enough to test with the full loop.

### 5.2 The Decision Wheel

On selecting a building, freeze camera drift and open a **radial menu** centered on the selected building's screen position (BGMI/PUBG weapon-wheel style — icons arranged in a circle, cursor angle selects, confirm on release or click):

- **Shed AC** (icon: snowflake with a slash) — reduces `acUsage` for 2 in-sim hours, small comfort/satisfaction cost shown as flavor text
- **Activate Solar Reserve** (icon: sun+battery) — boosts `solarBackupFactor` temporarily, limited by real irradiance
- **Delay EV Charging** (icon: car+clock) — removes `evChargingLoad` for a window, shown with a countdown
- **Hold / Do Nothing** (icon: pause) — explicit choice, logged, used to detect "guessing quickly without reading options" for the advisor's `eventContext`

Each wheel segment shows a **live predicted delta preview** (small numeric readout, e.g. "−4.2% load") computed by running `calculateGridLoad` against the hypothetical state before commit — this previews consequence before the player commits, which is critical for the "learning through consequence" philosophy to actually teach rather than punish blindly.

### 5.3 HUD Layout

- **Top-center**: crisis event banner + countdown timer (large, bold, appears only during an active event — battle-royale zone-timer style)
- **Top-left**: aggregate grid load gauge — circular arc meter, color-shifts per Section 3.2's thresholds
- **Top-right**: Learner Twin mini-widget — live decision count, blackout count, running "understanding" ring
- **Bottom-center**: AI advisor chat bubble (world-anchored via drei `<Html>`, follows the drone)
- **Bottom-right**: Equity Overlay toggle + Data Terminal shortcut icon
- **On zone select**: Decision Wheel (Section 5.2), all other HUD elements dim to 40% opacity to focus attention

### 5.4 Juice Checklist (implement every line — these are cheap and disproportionately effective)

- Screen shake (small positional camera noise, ~250ms) on any blackout trigger
- Hit-stop: global time-scale drop to 0.3 for 200ms at the moment a zone crosses into `blackout` — one frame of stillness before the lights actually die sells the moment
- Chromatic aberration + vignette pulse (postprocessing) spikes briefly on critical-threshold crossings
- Bloom intensity globally tied to `totalLoad/totalCapacity` — the whole city gets subtly harsher/brighter under strain
- Building selection: gentle scale-pulse (1.0→1.03→1.0, 200ms) on click, not just a color change
- Countdown timer: color shifts white→amber→red with an accelerating pulse under 10 seconds
- Camera micro-push-in on the affected block during any blackout (Section 3.3)

---

## 6. THE GAME LOOP (a single playthrough, ~4–6 minutes)

1. **Cinematic open** (Section 3.3) → HUD fades in → advisor drone intro line ("Grid's stable, Operator. Forecast's ugly though.")
2. **Baseline phase** (~30s): player can freely inspect zones, no pressure, tutorializes the Decision Wheel on the first click
3. **Event trigger**: crisis banner + countdown appears (e.g., "⚠ HEATWAVE ESCALATING — 2:00"), `ambient_pad` crossfades toward `tension_perc`
4. **Active crisis** (~2–3 min): temperature ramps, 1–2 zones cross `warning`→`critical`; advisor proactively interjects when a zone crosses `critical`; player makes 3–6 decisions via the Decision Wheel
5. **Resolution**: either the event timer expires with the grid intact (`resolution_sting`, drone congratulates, twin updates) or a zone hits full `blackout` (cinematic push-in, siren, `blackout_hit`, drone reframes calmly — "That's a real trade-off. Let's see why.")
6. **After-action report** (Section 8): Twin deltas vs. previous attempt, Equity Overlay auto-opens for 3 seconds, replay button
7. **Replay loop**: player can immediately re-run with the same event type — Monte Carlo variance means it's never identical — this is what produces the before/after evidence for Slide 4

---

## 7. DATA CONTRACTS — FULL INDEX

| Contract | Owner | Consumed by |
|---|---|---|
| `GridState` | A | 3D scene (materials), C, D |
| `LearnerTwin` | B | HUD widget, C, after-action report, Slide 4 export |
| `AdvisorRequest` / `AdvisorResponse` | C | advisor drone + chat bubble |
| `EIACalibrationRecord` | D | A (calibration constants), Equity Overlay, Data Terminal |

---

## 8. AFTER-ACTION REPORT (this is your judging-criteria payload — do not treat it as an afterthought)

A full-screen overlay at the end of each attempt:
- **Left**: this attempt's Twin snapshot vs. the previous attempt, using `recharts` (bar or radar chart — decisions made, blackouts caused, avg decision time, correct trade-off rate)
- **Right**: a scrollable `decisionLog` timeline — each entry shows the decision, the predicted delta, and the actual outcome, so a player (or a judge) can audit *why* the score is what it is
- **Bottom**: the Equity Overlay auto-triggers briefly with a one-line dynamic caption from `computeEquityDelta()`
- Export/screenshot-friendly layout — this screen is what you screen-record for the demo video's 4:00–5:00 segment

---

## 9. PERFORMANCE BUDGET

- Target 60fps on a mid-range laptop GPU; hard floor 30fps
- All repeated geometry (buildings, streetlights, trees, particles) via `InstancedMesh` — never individual meshes per building
- No external textures required; use `MeshStandardMaterial`/`MeshPhysicalMaterial` with flat colors + emissive, so bundle size stays small and load time stays near-zero
- Postprocessing passes capped (Bloom + Vignette + one of SSAO/ChromaticAberration) on detected low-end devices; full stack on desktop
- Adaptive pixel ratio (`Math.min(devicePixelRatio, 2)`) via `<Canvas dpr={...}>`
- Frustum culling is automatic in three.js — just avoid disabling it

---

## 10. FILE/FOLDER STRUCTURE

```
gridguard/
  src/
    engine/           # System A — pure functions, zero React/Three deps, unit-testable
      loadModel.ts
      montecarlo.ts
      crisisEvents.ts
    twin/              # System B
      twinStore.ts
      decisionLog.ts
    advisor/           # System C
      advisorClient.ts
      advisorPrompt.ts
      fallback.ts
    ethics/            # System D
      eiaSnapshot.json
      calibration.ts
      equity.ts
    scene/             # 3D world
      City.tsx
      Zone.tsx
      Building.tsx
      AdvisorDrone.tsx
      EquityOverlay.tsx
      DataTerminal.tsx
      HeatHaze.tsx
      PostFX.tsx
    hud/                # 2D overlay UI
      LoadGauge.tsx
      DecisionWheel.tsx
      CrisisBanner.tsx
      TwinWidget.tsx
      AfterActionReport.tsx
    audio/
      musicLayers.ts
      sfx.ts
    state/
      gameStore.ts       # zustand root store wiring A+B+C+D together
    App.tsx
  public/
```

---

## 11. NON-FUNCTIONAL REQUIREMENTS

| Category | Requirement |
|---|---|
| Performance | see Section 9 |
| Reliability | every external call (advisor, and the one-time EIA build fetch) is timeout-bounded with a deterministic fallback; the simulation and 3D scene run fully offline once loaded |
| Compatibility | evergreen Chrome/Edge/Firefox/Safari; responsive down to 375px with a simplified mobile HUD |
| Accessibility | zone state conveyed by icon + label in addition to color; Decision Wheel fully keyboard-operable (arrow keys + enter) as an alternative to mouse/touch |
| Privacy | no personal data collected; Twin state is in-memory, session-only, cleared on tab close; EIA data cached client-side is public aggregate data |

---

## 12. BUILD PHASES — EXECUTE IN ORDER

| Phase | Deliverable | Exit criteria |
|---|---|---|
| 0 — Foundation | Vite+R3F scaffold, empty scene with sky + ground plane, deployed to Vercel | live URL renders a 3D scene |
| 1 — City geometry | procedural block/zone generation, instanced buildings, roads, camera controls | full city renders, orbit/zoom works, 60fps |
| 2 — Simulation engine | `engine/` module complete with unit tests on the blackout boundary condition | `tick()` provably changes zone state under test inputs; architecture frozen |
| 3 — Load-reactive materials | window emissive system wired to `GridState`, day/night blackout darkening | visibly toggling a zone's load in a debug panel changes its building glow live |
| 4 — Decision Wheel + Twin | click-to-select, radial menu, delta preview, Twin state updates end-to-end | every decision updates both `GridState` and `LearnerTwin`, timer captured |
| 5 — Advisor drone | in-world drone, chat bubble, Gemini integration, schema validation, fallback | 100% of induced API failures resolve to fallback with zero UI hang |
| 6 — Ethics/EIA layer | EIA snapshot bundled, `calibrateZone`/`computeEquityDelta`, Equity Overlay, Data Terminal | overlay colors trace to real cached EIA values, not placeholder numbers |
| 7 — Game-feel pass | full adaptive music system, all juice checklist items (Section 5.4), crisis event pacing (Section 6) | a full playthrough has a clear tension arc: calm → rising → crisis → resolution |
| 8 — After-action report | full-screen report screen, recharts before/after, decision log | screen is demo-video-ready without further editing |
| 9 — Polish & verification | 10+ full playthroughs, mobile pass, performance audit, deploy final tag | zero crashes across 10 runs; 30fps floor holds on a mid-range laptop |

---

## 13. FINAL INSTRUCTION TO CLAUDE CODE

Build GridGuard exactly as specified above, phase by phase, in the file structure given in Section 10. Do not introduce a backend, database, or authentication system. Do not use external 3D asset files — generate all geometry procedurally with instanced primitives and flat/emissive materials as specified in Section 3. After each phase, run the dev server and visually confirm the exit criteria in Section 12 before continuing to the next phase. Treat Sections 4 (the four systems) as the non-negotiable architectural core; treat Section 5 (game-feel) as equally non-negotiable for the final product quality bar — a technically correct simulation with no juice will not read as a game. When in doubt about a real EIA API route or field name, state the assumption explicitly in a code comment and flag it for verification rather than fabricating a plausible-looking response.

**Begin with Phase 0.**
