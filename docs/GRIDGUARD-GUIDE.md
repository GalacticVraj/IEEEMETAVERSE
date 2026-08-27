# GridGuard — Complete Guide

**Everything the game is: how it works, every mode, every feature, every step of the player's journey.**

Meridian Bay Grid Operations · IEEE Metaverse Grand Challenge 2026
Branch `vraj` · verifieAd against the source on 2026-08-14

---

## Table of contents

1. [What GridGuard is](#1-what-gridguard-is)
2. [The world: Meridian Bay](#2-the-world-meridian-bay)
3. [How the game works — the physics that judge you](#3-how-the-game-works--the-physics-that-judge-you)
4. [The four modes](#4-the-four-modes)
5. [The user workflow — step by step](#5-the-user-workflow--step-by-step)
6. [The usage workflows — five ways to run it](#6-the-usage-workflows--five-ways-to-run-it)
7. [The tutorial in full](#7-the-tutorial-in-full)
8. [The console — every panel, every control](#8-the-console--every-panel-every-control)
9. [Operator actions — the levers](#9-operator-actions--the-levers)
10. [Scenarios](#10-scenarios)
11. [The Heatwave, minute by minute](#11-the-heatwave-minute-by-minute)
12. [Winning, losing and scoring](#12-winning-losing-and-scoring)
13. [The learning system](#13-the-learning-system)
14. [Camera, audio, accessibility, shortcuts](#14-camera-audio-accessibility-shortcuts)
15. [Architecture and doctrine](#15-architecture-and-doctrine)
16. [Running, building, URL parameters](#16-running-building-url-parameters)
17. [Honest limits](#17-honest-limits)

---

## 1. What GridGuard is

GridGuard is a browser-based smart-grid crisis simulator. You are the operator on shift at Meridian Bay, a coastal city of roughly 180,000 homes, during a record heatwave. Your job is to keep the city powered for one three-minute shift while generation fails underneath you.

Three things separate it from a dashboard demo:

- **The simulation is the product.** Rendering, UI, audio and the AI mentor are consumers of a deterministic physics engine. They never compute or cache authoritative state. Every number on screen is engine output.
- **Real physics, not scripted drama.** Frequency is integrated from the swing equation against real system inertia. Power flow is a DC solve over a 20-bus network. Protection relays trip on measured thermal loading. Nothing is on a timer pretending to be a consequence.
- **You are measured, not graded on vibes.** Every intervention is snapshotted before and after, judged on the actual telemetry delta, and fed into a mastery profile that persists across runs.

The philosophy, frozen at project start: **Simulation First, Rendering Second, UI Third.**

---

## 2. The world: Meridian Bay

A deterministic 230 kV regional transmission system. No seed required — the wiring diagram is fixed; scenarios mutate conditions on top of it.

| Element            | Count | Notes                                              |
| ------------------ | ----- | -------------------------------------------------- |
| Buses (nodes)      | 20    | Clustered by district                              |
| Transmission lines | 30    | Thermal ratings 120–400 MW, reactance 0.04–0.15 pu |
| Generators         | 8     | 1,150 MW total installed capacity                  |
| Load blocks        | 18    | ~895 MW nominal, 4 of them flagged critical        |
| Districts (zones)  | 6     | DT, IN, RN, RS, AP, HB                             |

### The six districts

| ID     | Name              | What lives there                                       |
| ------ | ----------------- | ------------------------------------------------------ |
| **DT** | Downtown          | Commercial core + Meridian General Hospital (critical) |
| **IN** | Industrial        | Heavy manufacturing — the largest single demand block  |
| **RN** | Residential North | High-income suburbs, school, EV charging, solar farm   |
| **RS** | Residential South | Dense working-class neighborhoods and a school         |
| **AP** | Airport           | Terminal + air-traffic control (critical)              |
| **HB** | Harbor            | Port industry + water treatment plant (critical)       |

### The generation fleet

| Unit      | Kind     | Capacity | Inertia H | Character                                                     |
| --------- | -------- | -------- | --------- | ------------------------------------------------------------- |
| G-BASE-S  | Baseload | 400 MW   | 5.0 s     | Southbay Baseload Plant. The workhorse. Cannot ramp.          |
| G-PEAK-S  | Peaker   | 220 MW   | 4.0 s     | South Gas Peaker. 5 MW/tick ramp.                             |
| G-IMPORT  | Import   | 200 MW   | 3.0 s     | Regional Import Tie over the harbor interconnect. 10 MW/tick. |
| G-SOLAR   | Solar    | 120 MW   | **0**     | Northfield Solar. Weather-derated; gone by dusk.              |
| G-WIND    | Wind     | 90 MW    | **0**     | Northfield Wind. Varies constantly.                           |
| G-PEAK-IN | Peaker   | 80 MW    | 4.0 s     | Industrial Gas Peaker.                                        |
| G-GAS-HB  | Peaker   | 60 MW    | 4.0 s     | Harbor Gas Unit. Black-start capable.                         |
| G-BATT-DT | Storage  | 50 MW    | **0**     | Downtown Battery. 20 MW/tick — instant, but finite.           |

The zeros matter. Solar, wind and storage contribute **no rotating mass**. Losing 400 MW of baseload is qualitatively worse than losing 400 MW of solar, and the console shows you exactly that through System inertia and RoCoF.

### Priority tiers

Every clickable building carries a tier. This is the ethical spine of the game.

| Tier | Label    | Examples                                                                       | Rule                                    |
| ---- | -------- | ------------------------------------------------------------------------------ | --------------------------------------- |
| 1    | Critical | Meridian General Hospital, Downtown Substation, baseload plant                 | Never shed. Not a preference — the law. |
| 2    | High     | Courthouse, airport terminal, harbor terminal, district substations, batteries | Last resort only                        |
| 3    | Medium   | Schools, corporate towers, solar/wind arrays                                   | Schedulable load                        |
| 4    | Flexible | Homes, EV stations                                                             | First to trim                           |

Residential South carries an explicit **equity note**: shedding there disproportionately hits low-income families. The scorecard has an axis for it.

---

## 3. How the game works — the physics that judge you

### Time

| Quantity        | Value                                                           |
| --------------- | --------------------------------------------------------------- |
| Tick rate       | 10 ticks per simulated second (100 ms wall-clock interval)      |
| Shift length    | 1,800 ticks = **3 minutes** of real time                        |
| Displayed clock | `T+mm:ss`, from `T+00:00` to `T+03:00`                          |
| Day phase       | Afternoon (t<540) → Golden hour (t<990) → Dusk (t<1400) → Night |

The city visibly darkens as the shift runs. That is not decoration — the same single arc drives solar irradiance in the physics and the lighting rig in the render, so when the sun leaves your solar farm, the sky agrees.

### The per-tick pipeline

Every one of the 1,800 ticks runs this sequence, in this order, inside `GridSimulationEngine.step()`:

1. **Weather advances.** Heatwave temperature follows a half-sine peaking about two-thirds through the shift (32 °C base, +11 °C amplitude). Irradiance follows the daylight arc. Wind drifts.
2. **Loads compute demand.** Topology base load (~895 MW) plus district-aggregate flexible appliance blocks (~186 MW), with a 2 %/°C heat response. Nominal total ≈ 1,081 MW against 1,150 MW of capacity — the grid _can_ balance, but only barely, and only if you act.
3. **Generation dispatches** toward demand, unit by unit, under per-kind ramp limits. Governor droop (5 % standard setting) scales the _urgency_ of an increase up to 4×. The governor sees last tick's frequency — as a real one must.
4. **DC power flow solves.** Island-aware Bθ=P per island with Gaussian elimination and partial pivoting. Pure function; it never mutates topology.
5. **Protection evaluates.** Relays observe line loadings, first-order RC thermal models heat the conductors, breakers open when a trip curve fires. Opened lines are bridged onto the domain bus as `LineTripped`.
6. **Cascade propagation** runs over the resulting flows.
7. **Zone status.** Any bus in a converged island with generation is powered. A district with no powered bus is in Blackout; partially powered is Degraded. Served vs. unserved MW is summed per district.
8. **Frequency integrates.** RoCoF = (60 × net MW) / (2 × system inertia). Frequency is the _integral_ of imbalance, clamped to 55–65 Hz, with 19 MW/Hz of load damping.
9. **UFLS relays fire** on the frequency the step actually produced.
10. **Restoration plans**, then the **Director paces** the run and owns win/lose semantics.

### Under-frequency load shedding — the most teachable moment in the game

| Stage | Fires at  | Sheds              |
| ----- | --------- | ------------------ |
| 1     | ≤ 59.3 Hz | 5 % of system load |
| 2     | ≤ 59.0 Hz | 10 %               |
| 3     | ≤ 58.7 Hz | 10 %               |

Stages **latch** — shed load stays shed. Real relays behave this way; automatic reconnection into a weak system is how you get a second collapse.

The teaching point is precise: UFLS always works. Frequency recovers, the system survives. But it recovers **by making a district dark**. A player who acts early never sees stage 1. A player who hesitates watches the grid save itself at the cost of the choice they refused to make.

### N-1 security screening

Reserve is summed across online units; the largest in-feed is the biggest single producing unit right now.

| Verdict      | Condition                                                   |
| ------------ | ----------------------------------------------------------- |
| **Secure**   | Reserve ≥ 1.2 × largest in-feed                             |
| **AtRisk**   | Reserve ≥ 1.0 × largest in-feed                             |
| **Insecure** | Reserve below the largest in-feed — one trip takes the city |

This is what real operators watch: not what is happening, but what _would_ happen if the biggest source vanished in the next second.

---

## 4. The four modes

The whole app is one page and one state machine. **The 3D city and camera persist across every mode** — only the overlay changes.

```
Hero ──Begin Shift──▶ Tutorial ──Start Scenario──▶ ActiveCrisis ──GameEnded──▶ AfterAction
  ▲                       ▲                                                        │
  └────── End Session ────┴───────────── Run Another Scenario ─────────────────────┘
```

| Mode             | What's on screen                                                                                                                  | How you leave                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Hero**         | Live city in slow orbit, minimal console-style landing card, two buttons: **Begin Shift** and **▶ Competition Demo**              | Begin Shift → Tutorial                               |
| **Tutorial**     | 7-second cinematic flyover, then the persona tutorial (first visit) or the assembled console with the scenario picker (returning) | Start Scenario → ActiveCrisis                        |
| **ActiveCrisis** | The full mission-control console over the live city. Kernel ticking, levers armed, score being measured                           | GameEnded, or End Shift → AfterAction                |
| **AfterAction**  | Evidence-based review layered over the console                                                                                    | Run Another Scenario → Tutorial · End Session → Hero |

`AppMode.Arrival`, `AppMode.Explore` and `AppMode.Briefing` still exist in the enum and compile, but nothing mounts them. They are dead flow from an earlier design.

**Tutorial is the single pre-flight mode.** It absorbed the old separate crisis-select screen. On a first visit it teaches; on every later visit the panels are already revealed and it behaves as a plain scenario picker. One mode, two behaviours, decided by a localStorage flag.

---

## 5. The user workflow — step by step

This is a complete first-time playthrough.

### Step 1 — Landing (Hero)

The city renders in daylight and orbits slowly. A single panel: _"You are the grid operator. Keep the city powered through the crisis."_ Two buttons.

Click **Begin Shift**.

### Step 2 — The intro flyover (7 seconds)

A Catmull-Rom camera flight over six real districts, each with a caption:

1. `MERIDIAN BAY — coastal smart grid digital twin`
2. `GENERATION SOUTH — 400 MW baseload anchors the city`
3. `INDUSTRIAL DISTRICT & HARBOR — heavy demand and water treatment`
4. `DOWNTOWN & HOSPITAL — commercial core and critical care`
5. `RENEWABLES NORTH — solar and wind balance the grid`
6. `RESIDENTIAL DISTRICTS — keeping 180,000 homes powered`

**Skip intro ▸** or **ESC** cuts to the console immediately. The console stays hidden until the camera lands at the operator's home framing — so the first thing you see is the city, not chrome.

### Step 3 — The tutorial (first visit only)

Chief Engineer Davis introduces the desk one panel at a time. Seven beats, roughly 90 seconds, fully skippable. See [§7](#7-the-tutorial-in-full) for every line and gate.

The console assembles progressively: command bar → grid health → inspect card → operator levers → timeline → scenario picker.

### Step 4 — Pick a scenario

The picker offers three cards with difficulty badges. **Record Heatwave** is marked ★ RECOMMENDED FIRST RUN — it builds slowly enough to think.

Select a card, click **Start Scenario ▸**. That call does three real things: clears the event log, starts the crisis session (kernel reset, scenario setup, tick loop begins), and flips the app to ActiveCrisis.

### Step 5 — Read the grid (T+00:00 → T+00:30)

Orientation. Cooling load climbs with the heat. Your scan, in the order Davis taught:

- **Balance** — is generation covering demand?
- **Frequency** — 60.00 Hz means balanced. Deviation is the trouble.
- **Corridor stress** — the busiest line's loading. At 100 %, protection drops it without asking you.
- **N-1 security** — would you survive losing your biggest unit right now?

Click anything in the city: a building, a substation bus, a generator, a transmission line. A tag appears at the object, and the full card lands in the left rail directly above the levers you'd use to respond.

### Step 6 — First shock (T+00:30)

The harbor gas unit trips on a heat-stressed voltage regulator. −60 MW. Small, legible, explained. The timeline logs it, the Understanding panel explains what/why/what-you-can-do, and Davis speaks up on channel one.

Watch the peakers and imports ramp to cover it. Watch reserve fall.

### Step 7 — The big one (T+01:00)

Southbay Baseload loses cooling water. **−400 MW.** System inertia halves. The evening peak now exceeds surviving capacity.

There is no scripted rescue. The outcome belongs to you.

### Step 8 — Act

Open the Operator Actions panel. Each lever shows cost, benefit, risk — and a **projection computed by the same physics that will judge you**: how many MW it removes, how much it moves frequency toward 60.00, whether it averts load shedding, or whether it would overshoot a grid that's already balanced.

Click **Execute**. The action commits with the real tick, the camera glides to the affected district, and the engine applies the actual load intervention.

Then wait 5 seconds of sim time. The Evidence Engine snapshots your telemetry again and Davis reports the **measured** result: _"'Dim commercial lighting' worked — peak corridor stress went from 94 % to 81 %."_ Or that it didn't.

### Step 9 — Hold to T+03:00

Manage the dusk. Solar leaves. Demand peaks into the evening. Use **Pause** (Space) to think — the physics freeze, the console stays readable. Use **Restart Run** to test a different strategy from T+00:00.

### Step 10 — The debrief

At 1,800 ticks the session declares **Held**. Or the Director ends it early on a loss. Either way you land in the After-Action Review: overall rating, six scored axes each with the numbers that earned them, grid performance stats, every intervention with its measured verdict, your concept mastery bars, and the run timeline.

Davis writes the debrief. If the Gemini proxy is reachable it rewrites the _same_ evidence in warmer prose and the panel title says so; otherwise the deterministic narrative stands. The provenance is always stated.

**Run Another Scenario** or **End Session**.

---

## 6. The usage workflows — five ways to run it

### A. First-time player

Hero → Begin Shift → intro → **full 7-beat tutorial** → scenario pick → play → debrief. The tutorial completion is written to `localStorage` under `gridguard.tutorial.completed.v1`.

### B. Returning player

Hero → Begin Shift → intro → **console arrives fully assembled** with the scenario picker already in the rail. No teaching. If the Learner Twin has history (attempt ≥ 2), Davis opens with a personalized note grounded in your actual record: _"Shift #3. Last time 1 district blackout got past you — protect those feeders before the evening peak. Your weakest concept is still FrequencyControl."_

A **Replay tutorial** chip appears in QuickControls during pre-flight if you want Davis to walk you through again.

### C. Hands-free competition demo

Click **▶ Competition Demo** on the hero, or load with `?demo`.

The driver presses the same buttons a human would, on a schedule gated by **real telemetry**:

| Trigger                               | Action                            |
| ------------------------------------- | --------------------------------- |
| Intro lands + ~1.5 s                  | Start the heatwave                |
| Corridor stress ≥ 80 %, or tick 420   | Execute _Dim commercial lighting_ |
| Stress ≥ 95 %, or tick 700            | Execute _Reduce residential AC_   |
| Tick 1500 (night — the visual payoff) | End the shift, open the debrief   |

Nothing is faked and nothing bypasses the simulation. The driver calls `skipForSession()`, not `complete()` — watching the demo never costs a curious player the tutorial they haven't seen.

### D. Guided tour (on demand, any time)

The **❓ Guide** chip opens a separate 7-step overlay tour of the interface. Distinct from Davis's tutorial: this one is a UI walkthrough you can open mid-crisis, and its scrim deliberately does not swallow clicks — it tells you to click things on the 3D map, so it has to let you.

Steps: Mission Overview → Grid Health Monitor → Scenario & Operator Levers → Timeline & Transport → 3D Asset Inspector → Understanding & Feedback → Outcomes Primer. Navigate with **Enter / → / ↓**, back with **← / ↑**, exit with **Escape**. Space is deliberately _not_ bound — it's the pause shortcut this tour teaches.

### E. Developer

```bash
pnpm dev          # Vite dev server
pnpm test         # Vitest (535 tests)
pnpm typecheck    # full app
pnpm typecheck:engine   # proves the pure layers compile with no DOM/React
pnpm validate     # typecheck + typecheck:engine + lint + test
pnpm build
```

Append `?debug` to the URL, or press **Ctrl+Shift+D**, for the developer overlay (tick, kernel state, render stats). It is opt-in only and never greets a player.

---

## 7. The tutorial in full

**Voice:** Chief Engineer Davis, nineteen years on the desk. Warm, unsentimental, short sentences. He explains what a control means and what it costs. He points at live readouts and never quotes a number the engine hasn't produced.

Seven beats. Each beat discloses exactly one console region when it starts.

| #   | Beat              | Reveals                                      | Gate                                                             | The substance                                                                                                                      |
| --- | ----------------- | -------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `arrival`         | Command bar                                  | Continue                                                         | Who he is, whose city this is, that every light runs on power down those lines                                                     |
| 2   | `vitals`          | Grid Health                                  | Continue                                                         | Demand vs. generation; negative Balance is _borrowing from physics_; **Corridor stress at 100 % is the grid deciding without you** |
| 3   | `inspect-prompt`  | —                                            | **Click a building** (12 s fallback → auto-selects the hospital) | "Those numbers are the whole city at once. When you need one building, ask it directly."                                           |
| 4   | `inspect-explain` | Context Inspector                            | Continue                                                         | The chip at the object, the depth in the rail. **Tier one never goes dark — that is not my preference, that is the law.**          |
| 5   | `levers`          | Operator Actions (preview, Execute disabled) | Continue                                                         | **"There is no free move."** Every lever costs something. Commit early — late is worse than imperfect.                             |
| 6   | `record`          | Timeline                                     | Continue                                                         | The grid keeps its own log. Click any marker for what happened, why, and what you could have done.                                 |
| 7   | `handoff`         | Scenario picker                              | "I'm ready"                                                      | "That is the desk. Pick your crisis. Heatwave's the one I'd start with."                                                           |

### Design rules baked into it

- **An interaction gate can never freeze a demo.** Beat 3 waits for a click, but after 12 seconds the manager selects the hospital itself and moves on. Satisfying the gate auto-advances after 700 ms — making you also press Continue would feel like being ignored.
- **The levers preview un-armed.** You can read every cost/benefit/risk before a shift exists, but Execute is disabled: committing a decision at tick 0 against a stopped session would be meaningless.
- **One shared rail slot.** Beats 5 and 7 use the same slot — levers preview, then the picker swaps in. The rail has a ~676 px budget at 1080p and both don't fit.
- **Skippable, always.** Skip completes it and remembers. Restart forgets the flag and starts from beat zero.
- **Persistence fails safe.** If localStorage is unavailable or throws (private mode, blocked cookies), every read degrades to "not yet completed" — you see the tutorial again rather than being locked out of it.
- **Game-warm narrative, SCADA instruments.** The persona, the unlock choreography and the world-anchored chip carry the warmth. Every instrument keeps graphite surfaces, mono numerals and 2–4 px radii. The frozen visual language is untouched.

---

## 8. The console — every panel, every control

One rail, not two. The old split forced you to click in the centre, read the consequence at the far right, and act at the far left — about 1,400 px of eye travel per decision. Now inspection lands directly above the actions that answer it.

**Layout:** 48 px command bar / flexible centre / 176 px timeline, with a 320 px left rail. The centre is intentionally empty — _the city is the interface_. The shell ignores pointer events so the 3D scene stays fully interactive through the middle.

### 8.1 Command bar (top)

| Element            | Behaviour                                                       |
| ------------------ | --------------------------------------------------------------- |
| Identity           | GRIDGUARD · MERIDIAN BAY OPERATIONS · active scenario name      |
| Sim clock          | `T+mm:ss` plus the day-phase label                              |
| Stability chip     | Pure display mapping of live telemetry                          |
| ⏸ Pause / ▶ Resume | Freezes the clock and the physics solver                        |
| End Shift          | Stops the session and opens the debrief with the measured score |

Stability thresholds:

| Chip          | Condition                                               |
| ------------- | ------------------------------------------------------- |
| **NORMAL**    | Everything below the bars                               |
| **ELEVATED**  | Corridor loading ≥ 80 %, or supply deficit ≥ 40 MW      |
| **EMERGENCY** | A line tripped, or loading ≥ 100 %, or deficit ≥ 150 MW |
| **BLACKOUT**  | ≥ 1 district dark                                       |
| **STANDBY**   | Not in an active run                                    |

### 8.2 Grid Health (pinned, top of rail)

Eleven live rows. Vitals are **pinned** — only the lower half of the rail scrolls, so the numbers that decide the run can never be scrolled out of sight mid-crisis. Each row carries a one-line meaning, shown during teaching and collapsible afterwards via the `?` / `−` toggle.

| Row             | Meaning shown to the player                                           | Colour thresholds                    |
| --------------- | --------------------------------------------------------------------- | ------------------------------------ |
| Demand          | What the city is asking for right now                                 | —                                    |
| Generation      | What all plants are producing together                                | —                                    |
| Balance         | Supply minus demand — negative means strained                         | amber < 0, red < −50 MW              |
| Frequency       | 60 Hz means balanced; drift shows mismatch                            | amber ≥ 0.2 Hz dev, red ≥ 0.5        |
| RoCoF           | How fast frequency is moving. A big number means a big loss, just now | amber ≥ 0.15, red ≥ 0.5 Hz/s         |
| System inertia  | Spinning mass resisting change. Wind and solar add none               | —                                    |
| N-1 security    | Whether you'd survive losing your biggest source right now            | green/amber/red by verdict           |
| Auto load shed  | _(appears only when fired)_ The grid saved itself by going dark       | always red                           |
| Renewables      | Share of clean energy in the current mix                              | —                                    |
| Corridor stress | Loading of the busiest transmission line                              | amber ≥ 60, orange ≥ 80, red ≥ 100 % |
| Zones dark      | Districts without power, with a household estimate                    | red when > 0                         |

Household figures are an explicit estimate (≈800 households per MW) and are always prefixed with `≈`.

### 8.3 Context Inspector (rail, below vitals)

Appears when you select something in the 3D city; absent otherwise, so it never occupies the rail for nothing. Four asset types, each with live metrics plus a collapsible **Why this matters** block (Why / Impact / Recommended).

| Selected              | Metrics shown                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Transmission line** | Flow MW, loading %, capacity, corridor endpoints. Status: NOMINAL / ELEVATED / HIGH STRESS / OVERLOADED / TRIPPING / TRIPPED / RECLOSING |
| **Generator**         | Output, capacity, utilization %. Status: GENERATING / STANDBY / AT LIMIT / TRIPPED                                                       |
| **Substation bus**    | Zone served MW, zone unserved MW, connected line count                                                                                   |
| **Building**          | Priority tier and label, teaching note, equity note where one applies                                                                    |

The card scrolls itself into view on selection, and the rail sets `overflow-anchor: none` — otherwise Chrome silently scrolls the container down by exactly the height of the card that just appeared, hiding the thing you clicked.

### 8.4 Operator Actions (rail, below inspector)

Two sections.

**Director prompts** render first when the simulation raises one — an urgent, scenario-driven decision with 3–4 options, in an orange-bordered _Decision Required_ block. The Director raises these at corridor overload, at cascade detection, and at zone blackout.

**The standing catalog** of five levers below it. Each row shows label, plain effect, cost, benefit, risk, and a live projection. Executing marks it `COMMITTED · T+mm:ss` and disables it for the run; a new run re-arms everything.

### 8.5 Timeline (bottom, full width)

Three regions:

- **Transport** — the sim clock in large type, **⏸ Pause Run**, **🔄 Restart Run** (resets the clock to T+00:00, clears the log, re-arms the scenario's faults and heals the graph).
- **Ruler** — the full `T+00:00 → T+03:00` span with a moving playhead, an elapsed fill, and a clickable marker for every real event. Critical events draw taller and brighter.
- **Event stream** — the last 40 entries, newest pinned at the bottom, colour-coded by severity (info / caution / warning / critical / recovery).

Every marker and entry originates from a real bus event. Nothing here is fabricated. Per-zone and weather events are deduped to state _changes_, because the engine re-emits ZonePowered every tick and it would otherwise flood the log. The ring buffer holds 200 entries.

Clicking any marker or entry focuses it in the Understanding panel.

### 8.6 Understanding (right of the timeline)

**One** contextual teaching card. No toast spam. It shows the timeline entry you clicked, or else the most recent warning/critical event, and answers three labeled questions:

- **What happened** — plain description of the event
- **Why** — the mechanism (e.g. _"Its protective relay detected current above the thermal limit and opened the breaker before the conductor could be damaged"_)
- **What you can do** — the actionable response

Dismissible; it reappears on the next important event. It sits beside the event stream that triggers it, not diagonally opposite.

### 8.7 Advisor card (top centre, in-play)

Davis's live voice, one message at a time, auto-expiring after 14 seconds, with a 20-second cooldown between messages. Four kinds:

| Kind            | Header             | Fires when                                                                   |
| --------------- | ------------------ | ---------------------------------------------------------------------------- |
| `question`      | THINK AHEAD        | Corridor stress crosses 90 % — _"which flexible load would you trim first?"_ |
| `explanation`   | WHAT JUST HAPPENED | A line trips, or a generator is lost                                         |
| `reinforcement` | WELL HELD          | A district is re-energized after a blackout                                  |
| `feedback`      | MEASURED RESULT    | An evidence record finalizes, with the real before/after numbers             |

Every message is assembled from real bus events or measured records. Nothing is invented.

### 8.8 After-Action Review

Everything is generated from the completed run — run-stats projection, event log, measured decision records, the Learner Twin, and the deterministic scoring engine.

| Section           | Contents                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header            | Outcome (Grid Held / Partial Blackout / System Blackout), shift length, intervention count, overall rating                                                 |
| Mission Debrief   | Davis's narrative, bylined, with the provenance stated in the panel title                                                                                  |
| Score cards       | Six axes, each with the numbers that earned it                                                                                                             |
| Grid Performance  | Peak demand, worst supply balance, peak corridor stress, avg renewable share, protection trips, unserved energy (MW·s), households affected, recovery time |
| Decision Analysis | Every intervention with timestamp, verdict badge, and the real stress before → after                                                                       |
| Concept Mastery   | Per-concept bars with confidence and observation count                                                                                                     |
| Run Timeline      | The last 14 non-info events from the log                                                                                                                   |

### 8.9 Chips and overlays

- **Camera HUD** (bottom centre): 📹 Auto-Follow toggle, 🎥 Overview Viewpoint. During the intro it becomes the caption strip plus **Skip intro ▸**.
- **QuickControls** (bottom right): ❓ Guide, 🔊 Sound toggle, the shortcut legend, and _Replay tutorial_ in pre-flight.
- **Debug overlay**: `?debug` or Ctrl+Shift+D. Developer only.
- **Tooltips**: rich hover tooltips on nearly every control, giving the engineering reason and the keyboard shortcut.

---

## 9. Operator actions — the levers

Five standing actions, ~223 MW of relief in total against a gap of roughly 60–130 MW. The catalog is deliberately sized so your levers genuinely decide the outcome.

| Lever                          | Relief | Cost                           | Benefit                                   | Risk                                        | What the engine actually does                                  |
| ------------------------------ | ------ | ------------------------------ | ----------------------------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| **Reduce residential AC**      | 78 MW  | Homes warm up a few degrees    | Large, fast demand drop                   | Public discomfort in a heatwave             | Turns off the `ac` appliance block in every RN and RS building |
| **Pause public EV charging**   | 34 MW  | Drivers wait to charge         | Removes concentrated fast-charge spikes   | Airport and fleet vehicles delayed          | Turns off `ev` in every building, city-wide                    |
| **Dim commercial lighting**    | 22 MW  | Dimmer offices and storefronts | Relieves downtown corridor stress         | Minimal — lowest-impact lever               | Turns off `lights` across Downtown                             |
| **Controlled industrial shed** | 63 MW  | Factory output lost            | Big relief on the southern backbone       | Economic cost; restart takes time           | Sheds 30 % of `LD-IN-HVY` (150 MW) and `LD-IN-LGT` (60 MW)     |
| **Emergency harbor shed**      | 26 MW  | Port operations slow           | Frees the harbor interconnect for imports | Water treatment protected, but margins thin | Sheds 25 % of `LD-HB-IND` (70 MW) and `LD-HB-SHIP` (35 MW)     |

The two shed levers are exact fractions of named topology loads. The three appliance levers are the modelled block wattage for that category, so they move with the calibration rather than being invented in the UI.

### The projection line

Under each un-committed lever, the console runs the engine's **what-if API** against a copy of the live operating point. It never touches live state, and it uses the same physics that will judge you afterwards — estimating this separately in the UI would eventually disagree with the simulation, and a teaching tool that lies about consequence stops teaching.

It reports:

- `−N MW` — the demand removed
- `+0.NN Hz toward 60.00` — the frequency deviation it closes
- **`avoids load shedding`** — this lever keeps UFLS from firing
- **`still sheds`** — not enough on its own
- **`not needed — would overshoot to 60.NN Hz`** — the grid is already balanced; shedding further would push frequency _above_ nominal. Reporting the raw rise as a gain would be recommending an over-frequency excursion.
- `no measurable change`

### How a decision travels

```
Click Execute
  → UI emits DecisionCommitted { decisionId: "op-xxx-<tick>", optionIndex, simTime }
  → Engine's handler maps the id to real load-model interventions
  → Camera glides to the affected district
  → Evidence Engine snapshots pre-telemetry
  → 50 ticks (5 s) later: post-snapshot, verdict, Learner Twin update
  → Advisor reports the measured result
  → After-Action lists it with the real before/after numbers
```

The UI never touches the engine directly. It emits an event; the engine decides what that means.

---

## 10. Scenarios

Eight scenarios are registered in the container. **Three** are surfaced on the selection cards.

### Selectable

| Scenario                           | Difficulty | Arc                                                                                                                                                                                            |
| ---------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Record Heatwave** ★              | Warning    | Cooling demand climbs past safe limits, then a baseload generator loses cooling water and forces the grid toward cascade. The flagship.                                                        |
| **Coastal Storm**                  | Critical   | Lightning trips the renewable export line at tick 30; salt-spray flashover isolates the harbor at tick 50; the wind farm trips on overspeed at tick 80.                                        |
| **Transformer Differential Fault** | Warning    | Tick 20: DT4-HB1 main infeed clears on a differential fault. Tick 40: IN1-HB1 trips thermally after re-routing. Tick 60: DT1-IN1 breaches its limit. Sequential failure into an N-2 violation. |

### Registered but not surfaced

Cyber Attack · Generator Loss · Substation Failure · Demand Surge · Transformer Failure. All implement `ICrisisScenario` and are live in the registry — they simply aren't on the cards.

Every scenario is a plugin: `setup(context)` arms its faults, `onTick(context)` scripts them against real ticks, `teardown()` restores everything. Scenarios inject faults; they never fake physics. A scenario trips a generator — what happens next is the engine's business.

---

## 11. The Heatwave, minute by minute

Choreographed for a three-minute demonstration arc.

| Time                | Ticks    | What happens                                                                                                                                                     |
| ------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T+00:00 – 00:30** | 0–299    | _Afternoon._ Orientation. Cooling load climbs with the heat. You read the console and the city. Solar is producing.                                              |
| **T+00:30**         | 300      | **First tension.** Harbor gas unit `G-GAS-HB` (60 MW) trips on a heat-stressed voltage regulator. Small enough to explain, real enough to move the balance.      |
| **T+00:30 – 01:00** | 300–599  | Peakers and imports ramp to cover. Corridor stress builds into golden hour. Reserve erodes.                                                                      |
| **T+01:00**         | 600      | **The big one.** Southbay Baseload `G-BASE-S` (400 MW) loses cooling water. System inertia halves, roughly 3,800 → 1,800 MW·s. RoCoF spikes near −6.7 Hz/s.      |
| **T+01:00 – 03:00** | 600–1800 | _Dusk → night._ Solar leaves. Demand peaks into the evening. Protection, cascade risk and the Director resolve the consequences of whatever you did — or didn't. |
| **T+03:00**         | 1800     | Shift ends. Outcome **Held** if you're still standing.                                                                                                           |

There is **no scripted rescue**. An earlier build automatically shed industry to save you; it was removed by design so the outcome belongs to the player.

**Known open behaviour:** with no operator action at all, the t=600 baseload loss drives frequency onto the 55 Hz floor and it rides there for the rest of the run rather than resolving into an explicit game-over. The run still ends and still scores; it just doesn't declare the collapse as cleanly as it should.

---

## 12. Winning, losing and scoring

### Terminal conditions

| Outcome             | Trigger                                            | Owner          |
| ------------------- | -------------------------------------------------- | -------------- |
| **Held**            | Survive to tick 1,800                              | Crisis session |
| **SystemBlackout**  | ≥ 2 districts dark simultaneously — immediate      | Director       |
| **PartialBlackout** | ≥ 1 district dark for 150 consecutive ticks (15 s) | Director       |

You can also end early yourself: **End Shift** stops the session and scores what you achieved.

### The scorecard — six axes plus an overall

Deterministic, pure, and every score carries a reason citing the numbers that earned it. No randomness, no wall clock, no invented figures.

| Axis                                 | Weight | How it's computed                                                                                                                               |
| ------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Operational Performance**          | 25 %   | Outcome base (Held 90 / Partial 55 / System 30) minus an unserved-energy penalty capped at 30                                                   |
| **System Stability**                 | 20 %   | 100 − (peak corridor stress × 40) − (line trips × 6)                                                                                            |
| **Decision Quality**                 | 15 %   | Share of interventions that measurably improved the grid, minus 5 per worsening. No interventions at all scores 40 — _"the grid ran unmanaged"_ |
| **Resilience**                       | 15 %   | 95 if no district ever went dark; 85 − recovery_seconds/2 (floor 40) if it recovered; 25 if it never did                                        |
| **Learning Progress**                | 15 %   | Evidence-weighted mastery across concepts, weighted by observation count. 50 when there's no evidence yet                                       |
| **Equity & Critical Infrastructure** | 10 %   | Capped at 35 if the hospital district went dark; otherwise 55 + equity awareness × 0.45                                                         |

The overall rating is the weighted blend, and it says so in its own reason line.

Example reasons the player actually sees:

> _"Peak corridor stress reached 96 % with 2 protection trip(s)."_
> _"2 of 3 intervention(s) measurably improved the grid; 0 made it worse."_
> _"The hospital district (Downtown) lost power — protecting critical loads is the first duty."_

---

## 13. The learning system

### Evidence Engine — measurement, not opinion

For every `DecisionCommitted`:

1. Snapshot real telemetry now: max line loading, supply balance, dark zone count, unserved MW.
2. Wait 50 ticks (5 simulated seconds).
3. Snapshot again.
4. Judge on the **actual deltas**, never on estimates.

| Verdict       | Condition                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------- |
| **improved**  | Loading fell ≥ 0.02, or unserved fell ≥ 1 MW, or a dark zone came back, or balance rose ≥ 20 MW |
| **worsened**  | Any of those moved the wrong way past the same thresholds                                       |
| **no-effect** | Everything inside the noise band                                                                |
| **pending**   | The window hasn't matured yet — still shown, never hidden                                       |

It also awards **passive evidence** for run-level facts it can verify: the hospital district never went dark (Equity), a cascade was contained shortly after a decision, sustained renewable share above 25 %.

The engine is strictly read-only over the simulation. It observes the bus and calls `getState()`; it never mutates anything.

### Learner Twin — persistent mastery

Per-concept `{ mastery, confidence, evidenceCount }`, where confidence is `n/(n+3)` — few observations mean low confidence, and the UI shows both. Passive evidence counts at half weight. The twin tracks attempts, blackouts caused, decisions made, and weak concept tags, and it survives across runs to feed the personalized run opener.

### Davis, one voice, three places

The tutorial, the in-play advisor card and the after-action byline are all the same person. Only the presentation is personified — the advisor's evidence logic is untouched.

### Gemini integration

An edge-function proxy at `/api/advisor`. The key lives in `process.env` on the server and is never bundled into client JS. Rate-limited to 30 requests/hour per IP.

The contract is strict: the client sends **only measured facts** — timestamps, verdicts, scores with reasons — and Gemini's job is to _rewrite that evidence_ into warmer prose. Hard guardrails forbid inventing timestamps, events, numbers or recommendations not derivable from the provided context.

The deterministic narrative renders instantly from local evidence. If Gemini responds within its 6-second timeout, it swaps in and the panel title changes to say so. Missing key, network failure, timeout — all degrade silently to the deterministic text. The player always gets a debrief.

---

## 14. Camera, audio, accessibility, shortcuts

### Camera

**One** CameraDirector owns all camera movement — hero orbit, intro flight, selection framing, crisis follow. Nothing else is allowed to mount a camera. Intents are resolved by priority:

| Priority | Intent                                                           |
| -------- | ---------------------------------------------------------------- |
| 100      | Intro flyover                                                    |
| 95       | Decision committed → glide to the affected district              |
| 90       | Asset selection → inspect framing, with pose save/restore        |
| 80       | Crisis follow (critical/recovery events, when Auto-Follow is on) |
| 70       | Reserved for replay playback                                     |
| 60       | Overview / operator home                                         |
| 0        | Manual orbit                                                     |

Auto-follow suppresses itself for 8 seconds after any manual input, so it never fights you. Framing is constrained — never tighter than 55 units, so surrounding city context stays visible. It's a digital twin, not a game camera. Zero allocations in the frame loop.

### Audio

A WebAudio-synthesized layer with no asset files at all — ambient grid hum and crisis cues generated in code, reacting to real events. Starts on first gesture. Toggle with **M** or the chip.

### Accessibility

- `prefers-reduced-motion` skips the intro flight, disables auto-follow, and kills CSS animation.
- The tour scrim never swallows clicks.
- Rich tooltips on effectively every control.
- Progressive disclosure means a newcomer is never shown six panels at once.
- localStorage failure degrades safely rather than locking anyone out.

### Keyboard shortcuts

| Key               | Action                                                            |
| ----------------- | ----------------------------------------------------------------- |
| **Space**         | Pause / resume the run (ActiveCrisis only; ignored while typing)  |
| **O**             | Overview camera viewpoint                                         |
| **M**             | Sound on/off                                                      |
| **ESC**           | Skip intro · cancel a scripted camera move · exit the guided tour |
| **Enter / → / ↓** | Guided tour: next step                                            |
| **← / ↑**         | Guided tour: previous step                                        |
| **Ctrl+Shift+D**  | Toggle the developer overlay                                      |

---

## 15. Architecture and doctrine

### Six systems over a deterministic kernel

| Layer                  | Path                 | Status                                                                                                  |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------------------------------- |
| **Simulation Kernel**  | `src/kernel`         | Deterministic time, xoroshiro128+ RNG, scheduler, system registry, FSM, snapshots                       |
| **A — Simulation**     | `src/engine`         | Graph, DC power flow, protection, frequency, weather, loads, generation, cascade, restoration, director |
| **B — Learning**       | `src/learning`       | Evidence engine, learner twin, scoring                                                                  |
| **C — Presentation**   | `src/rendering`      | Scene graph, camera, city layout, atmosphere, time-of-day                                               |
| **D — UI**             | `src/ui`             | Console, onboarding, advisor, after-action                                                              |
| **E — Audio**          | `src/audio`          | WebAudio director                                                                                       |
| **F — Infrastructure** | `src/infrastructure` | Bootstrap, DI composition root, crisis session                                                          |

Plus first-class `src/replay` (record / verify / playback), plugin `src/scenarios`, domain `src/ethics`, `src/state` (Zustand projections updated by events only), and `src/core` (typed event bus, DI container, Result, branded types).

**Stack:** React 18 · strict TypeScript · Vite · React Three Fiber / Three / Drei · GSAP · Tailwind · Zustand · Vitest · ESLint with import boundaries · pnpm.

The kernel FSM: `Boot → Loading → Configuration → RegisterSystems → Calibration → Idle ⇄ Running ⇄ Paused → Replay → Shutdown → Disposed`.

### The five frozen directives

1. **Simulation is the single source of truth.** Rendering, UI, audio, replay, analytics and AI are consumers only. They may never compute, infer, cache or mutate authoritative state. Enforced mechanically: state stores are projections updated by events only, ESLint import boundaries, and a separate `tsconfig.engine.json` that proves the pure layers compile with no DOM and no React.
2. **Every visual effect must have a traceable simulation cause.** No decorative animation.
3. **Frozen visual language.** A premium engineering operations console — SCADA, industrial control rooms, NASA Mission Control. Forbidden: generic AI dashboards, glassmorphism, neon cyberpunk, oversized rounded cards, decorative gradients.
4. **Engineering realism beats visual decoration** whenever they conflict.
5. **Every feature must strengthen at least one pillar:** engineering credibility · educational impact · simulation realism · memorable demo moments · judging evidence.

### Decisions deliberately made and not to be re-litigated

- **Droop is not a parallel power term.** Ramp limits _are_ primary response; droop scales ramp urgency on increases only. A parallel injection would double-count.
- **Inertia constants follow Kundur Table 3.2.** Baseload 5.0 s, Peaker 4.0, Import 3.0, Solar/Wind/Storage 0.
- **UFLS is latching** and evaluated _after_ swing integration, on the frequency the step actually produced.
- **Primary response leaves a steady-state frequency offset.** There is no AGC, so recovery lands near but not exactly on 60.000. A model that snapped back cleanly would be wrong.

---

## 16. Running, building, URL parameters

```bash
pnpm install
pnpm dev                 # http://localhost:5173
pnpm test                # 535 tests
pnpm typecheck           # full app, 0 errors
pnpm typecheck:engine    # pure layers, no DOM/React
pnpm lint
pnpm validate            # all of the above
pnpm build               # typecheck + vite build
pnpm preview
```

| URL parameter | Effect                                               |
| ------------- | ---------------------------------------------------- |
| `?demo`       | Hands-free competition walkthrough from a cold start |
| `?debug`      | Developer overlay visible from load                  |

Optional environment: `GEMINI_API_KEY` on the server enables the AI mentor rewrite. Without it, `/api/advisor` returns `no_api_key` and the deterministic narrative stands — silently, with no degraded experience.

---

## 17. Honest limits

Stated plainly, because a credibility-first project should say what it doesn't do.

- **Transformers have no impedance model** and are excluded from the power flow.
- **No AGC**, so frequency recovery settles near but not exactly at 60.000 Hz. This is deliberate and correct for the model.
- **Replay playback is unwired.** The recorder, serializer and verifier are real and tested; the camera reserves priority 70 for playback, but nothing drives it yet.
- **Five of eight scenarios are registered but not surfaced** on the selection cards.
- **A no-action heatwave rides the 55 Hz floor** rather than declaring an explicit collapse.
- **Several learning-layer services are still placeholders** — knowledge tracer, concept graph, reference policy, decision scorer, analytics collector. The Evidence Engine, Learner Twin and run scoring are real; those are not.
- **Deliberately deferred visuals:** 3D vehicles, trains, pedestrians, SSAO, reflections, a music system.
- **Repo lint baseline** carries roughly 440 pre-existing errors; type-safety rules are relaxed for test files only, and stay on for production code.
- **The headless visual audit is render-starved** (~0.15 sim-seconds per real second on a software GPU). Any sampling window under ~15 s produces false negatives.

---

_GridGuard — simulation-based energy literacy. Live physics, no scripted numbers._
