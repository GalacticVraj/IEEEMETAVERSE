# Implementation Plan — UI & Onboarding Overhaul

**Status:** awaiting approval. No code has been modified.
**Branch:** `vraj`
**Goal:** turn GridGuard from a data-dense console into a premium, accessible simulation
game — without surrendering the engineering credibility that wins the judging.

---

## 0. Decisions locked in the brainstorm

| #   | Question                                      | Decision                                                                                                                                                                                                               |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Doctrine #3 (SCADA) vs. Clash-of-Clans polish | **Game-warm narrative layer, SCADA instruments untouched.** Panels keep graphite/mono/2–4px radii. Game feel applies only to the persona, unlock choreography, pacing and contextual popups. Doctrine #3 stays intact. |
| 2   | Where `AppMode.Tutorial` sits                 | **Tutorial absorbs `CrisisSelect`.** `Hero → Tutorial → ActiveCrisis → AfterAction`. Davis's final beat _is_ the scenario pick.                                                                                        |
| 3   | Repeat visits                                 | **Auto on first visit, remembered in localStorage, always skippable.** `?demo` bypasses it. "Replay tutorial" lives in QuickControls.                                                                                  |
| 4   | Portrait art                                  | **Hand-authored inline SVG**, no asset pipeline, recolours with grid status.                                                                                                                                           |
| 5   | Inspector relocation                          | **Hybrid:** tiny world-anchored chip at the object **and** a full inspect card in the left rail adjacent to Operator Actions. Right rail dissolves.                                                                    |
| 6   | Persona scope                                 | **Davis is the single mentor voice** — tutorial, in-play AdvisorCard, after-action byline. Advisor evidence logic is untouched; only presentation is personified.                                                      |

---

## 1. What's wrong today (verified in code, not assumed)

- `src/ui/console/ConsoleShell.tsx:29-33` — a `300px / 1fr / 320px` grid renders **all six panels
  simultaneously** the instant `mode` becomes a console mode. Nothing is staged.
- `src/App.tsx:96` — `ConsoleShell` mounts fully-formed. Onboarding is one dismissible card
  (`MissionBriefing.tsx`, three bullets) that cannot teach a control it doesn't point at.
- **The disconnect is real and structural.** Actions live in the left rail
  (`OperatorActionsPanel`, `ConsoleShell.tsx:53`); the consequence of clicking a building renders
  in the right rail (`AssetInspector`, `ConsoleShell.tsx:71`). The player clicks centre, reads far
  right, then acts far left — roughly 1,400px of eye travel per decision loop on a 1080p screen.
- `LearningFeedback` is in the right rail but is **not** driven by asset selection at all — it reads
  `useEventLogStore.focusedSeq` (`LearningFeedback.tsx:12-21`). Its trigger is the **Timeline**,
  which sits at the opposite corner of the screen from it.
- `AppMode.Explore` / `Arrival` / `Briefing` remain in the enum but are unreachable
  (`app-flow-store.ts:14-19`); `CrisisSelectScreen.tsx` and `advisor-drone.tsx` compile but are
  never mounted.

---

## 2. Target architecture

### New module `src/ui/onboarding/`

| File                  | Responsibility                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tutorial-steps.ts`   | Pure data. The ordered beat list — dialogue, which panel each beat unlocks, how each beat is gated. No React, no side effects, unit-testable.           |
| `DavisPortrait.tsx`   | Inline SVG portrait. Props: `mood`, `size`. Colours drawn from existing tokens.                                                                         |
| `PersonaDialog.tsx`   | Presentational only. Portrait + name plate + typewriter text + `Next` / `Skip`. Knows nothing about the tutorial's rules.                               |
| `TutorialManager.tsx` | The controller. Reads the store, resolves each beat's gate, issues camera intents, calls `reveal(panel)`, advances. Mounted only in `AppMode.Tutorial`. |
| `Reveal.tsx`          | Generic wrapper: hides its children until its panel id is revealed, then animates them in from a given edge. Honours `prefers-reduced-motion`.          |
| `index.ts`            | Barrel.                                                                                                                                                 |

### New store `src/state/tutorial-store.ts`

Sits beside `ui-store.ts`, which already carves out the precedent in its own docstring:
_"UI-ONLY state (selection, panel visibility). The UI legitimately OWNS this — it is not simulation
state and never feeds back into the engine."_ Panel visibility is exactly that. **Doctrine #1 is not
touched: this store is never written by the engine and never read by it.**

```ts
export type PanelId = 'command' | 'health' | 'inspect' | 'actions' | 'timeline' | 'scenario';

interface TutorialState {
  readonly active: boolean;
  readonly stepIndex: number;
  readonly revealed: ReadonlySet<PanelId>;
  readonly completed: boolean; // mirrored to localStorage

  readonly begin: () => void; // no-op if already completed → revealAll()
  readonly advance: () => void; // next beat, reveals that beat's panel
  readonly reveal: (id: PanelId) => void;
  readonly revealAll: () => void;
  readonly skip: () => void; // completed = true, revealAll, active = false
  readonly complete: () => void;
  readonly restart: () => void; // "Replay tutorial" in QuickControls
}
```

Persistence key `gridguard.tutorial.completed.v1` (versioned so a future rewrite can force a replay).
Reads are wrapped in try/catch — a blocked localStorage degrades to "always show", never throws.

### Layout

```
┌──────────────────────────────────────────────────────┐
│ COMMAND BAR                              reveal:top  │  48px
├────────────┬─────────────────────────────────────────┤
│ Grid Health│                                         │
│  reveal:←  │                ┌──────────┐             │
│            │                │ DT-Hosp  │ ← chip,     │
│ ▸ INSPECT  │                │ TIER 1 ● │   anchored  │  1fr
│  (on click)│                │  12 MW   │   in world  │
│            │                └─────╲────┘             │
│ OPERATOR   │                      ◉                  │
│  ACTIONS   │        3D CITY            ┌───────────┐ │
│  reveal:←  │                           │Understand.│ │
│            │   ┌────────────────────┐  │  (floats) │ │
│            │   │  ▣  CHIEF ENG.     │  └───────────┘ │
│            │   │     DAVIS          │                │
│            │   │  "First thing…"    │                │
│            │   └────────────────────┘                │
├────────────┴─────────────────────────────────────────┤
│ TIMELINE                              reveal:bottom  │  176px
└──────────────────────────────────────────────────────┘
     320px                    1fr
```

Two changes from the sketch you approved, both deliberate:

1. **Health sits above Inspect, Inspect directly above Actions.** Your brief said inspection data
   should go _"directly into (or floating right next to) the OperatorActionsPanel."_ Putting Inspect
   between Health and Actions makes the inspected asset physically adjacent to the levers you'd pull
   on it — cause touching effect. Health stays pinned at the top because it's the one panel that is
   always relevant. Say the word and I'll flip to Inspect-first.
2. **Left rail widens 300 → 320px**, reclaimed from the dissolved right rail, so the inspect card
   keeps its current line lengths rather than getting cramped.

`LearningFeedback` floats bottom-right (`bottom: 186px; right: 14px; width: 320px`) — beside the
Timeline event stream that actually triggers it, instead of diagonally opposite.

---

## 3. The `AppMode.Tutorial` flow

`AppMode.CrisisSelect` is **replaced** by `AppMode.Tutorial` — one pre-flight mode, not two.

```
Hero
 │  "Begin Shift"  → beginShift()
 ▼
AppMode.Tutorial ────────────────────────────────────────────┐
 │  camera intro flyover plays underneath (unchanged)        │
 │                                                            │
 │  completed === true  ──► revealAll(), no dialog            │  ← repeat visit,
 │                          behaves exactly like today's         ?demo, post-run
 │                          CrisisSelect                         replay()
 │                                                            │
 │  completed === false ──► TutorialManager drives 7 beats,   │
 │                          revealing one panel per beat      │
 ▼                                                            │
 "Start Scenario"  → session.start(id) + selectCrisis(id)     │
 ▼                                                            │
AppMode.ActiveCrisis  ──GameEnded──►  AppMode.AfterAction ────┘
                                        │ "Run Again" → replay() → Tutorial
                                        │ (revealed, no dialog)
```

**Gates.** Six beats advance on `Next`. Beat 3 waits on a real interaction (the player must click
something in the city) — with a **12-second fallback** that auto-selects `DT-Hosp` and camera-frames
it, so a demo in front of judges can never stall on an un-clicked building.

**Skip** is present on every beat: one click sets `completed`, calls `revealAll()`, and drops the
player at a fully-assembled console with the ScenarioPanel ready.

---

## 4. Davis's dialogue — the full script

Voice: nineteen years on the desk, warm but unsentimental, short sentences. **Every claim is
qualitative and true of the real simulation** — he points at live readouts and never quotes a number
the engine hasn't produced (doctrine #1 and #2).

**Beat 1 · `arrival` — reveals `command` — gate: Next**

> "Meridian Bay control room. I'm Davis, chief engineer — nineteen years on this desk."
> "That city out there is yours for the next shift. Every light in it runs on power we push down those lines."
> "Let me show you the desk. Won't take long."

**Beat 2 · `vitals` — reveals `health` — gate: Next — camera: city overview**

> "First thing any operator checks: vital signs."
> "Demand is what the city is pulling. Generation is what we're making. When Balance goes negative we're borrowing from physics — and physics always collects."
> "The one that ends careers is Corridor stress. At a hundred percent, protection drops the line to save the hardware. That isn't a warning. That's the grid deciding without you."

**Beat 3 · `inspect-prompt` — reveals nothing — gate: player selects any asset (12s fallback)**

> "Those numbers are the whole city at once. When you need one building, ask it directly."
> "Go on — click something out there. The hospital's a good place to start."

**Beat 4 · `inspect-explain` — reveals `inspect` — gate: Next**

> "There it is — right where you clicked, and the detail lands over here by your controls."
> "Every building carries a priority tier. Tier one never goes dark. That's not my preference, that's the law."
> "Get in the habit of asking the city questions before you act on it."

**Beat 5 · `levers` — reveals `actions` — gate: Next**

> "Knowing is half the job. This is the other half."
> "Every lever costs something. Cut cooling, people sweat. Pause EV charging, someone's late for work. Shed a district and you turn the lights off on purpose."
> "There is no free move. Read the cost, the benefit and the risk — then commit early. Late is worse than imperfect."

**Beat 6 · `record` — reveals `timeline` — gate: Next**

> "The grid keeps its own log. Every trip, every recovery, timestamped."
> "Click any marker and I'll tell you what happened, why, and what you could have done instead."
> "That's how operators get better. Not from me lecturing — from the record."

**Beat 7 · `handoff` — reveals `scenario` — gate: Next, CTA "I'm ready"**

> "That's the desk. Pick your crisis."
> "Heatwave's the one I'd start with. It builds slow enough to think."
> "I'll be on channel one all shift. Good luck, operator."

~75–100 seconds at a natural reading pace. Typewriter runs at 22ms/char; clicking mid-type completes
the line instantly (the pattern already proven in `advisor-drone.tsx:58-66`).

---

## 5. `ConsoleShell.tsx` restructure

```tsx
export function ConsoleShell({ mode }: { mode: AppMode }): ReactElement {
  const preflight = mode === AppMode.Tutorial;

  return (
    <div style={{/* rows 48px 1fr 176px · cols 320px 1fr · pointerEvents none */}}>
      <Reveal id="command" from="top" style={{ gridColumn: '1 / -1' }}>
        <CommandBar />
      </Reveal>
      <div /* left rail */>
        <Reveal id="health" from="left">
          <GridHealthPanel />
        </Reveal>
        <Reveal id="inspect" from="left">
          <ContextInspector />
        </Reveal>
        <Reveal id="actions" from="left">
          {preflight ? <ScenarioPanel /> : <OperatorActionsPanel />}
        </Reveal>
      </div>
      <div /* centre: the city IS the interface */ />
      <Reveal id="timeline" from="bottom" style={{ gridColumn: '1 / -1' }}>
        <Timeline />
      </Reveal>
      <FloatingUnderstanding /> {/* bottom-right, gated on `timeline` */}
    </div>
  );
}
```

**`Reveal` mechanics.** Hidden state is `opacity: 0`, `transform: translateX(-24px)` (or the matching
axis), `pointerEvents: 'none'`, `visibility: hidden` applied on `transitionend` so hidden panels are
removed from the a11y tree and can't be tabbed into. Shown state transitions
`opacity 420ms ease` + `transform 420ms cubic-bezier(.16,1,.3,1)`. Under
`prefers-reduced-motion` the transition duration drops to `0ms` — the existing `src/ui/accessibility/a11y.ts`
hook is reused, not reinvented. The panels themselves mount at all times; only their wrapper animates,
so no panel loses state or re-subscribes when it appears.

**Note on the `scenario` panel id.** `ScenarioPanel` and `OperatorActionsPanel` occupy the same slot
in different modes, so the slot is revealed by `actions` and beat 7 reveals `scenario` — which in
`AppMode.Tutorial` resolves to the same wrapper. `PanelId` keeps both ids so the beat script reads
honestly and the ordering test can assert full coverage.

---

## 6. The inspector, relocated

**`src/ui/console/ContextInspector.tsx`** — a refactor, not a rewrite, of `AssetInspector.tsx`. All
four branches (line / generator / bus / building) and every call into `learning-copy.ts` are kept
verbatim. Three changes:

- Returns `null` when nothing is selected (today it renders a "Select a transmission line…"
  placeholder that would sit dead in the rail).
- Compacted header: title, subtitle, close ✕, and status LED on one row.
- `Why / Impact / Recommended` collapse to a `▾ more` disclosure below the fold so the card never
  pushes Operator Actions off-screen at 1080p. Open by default during the tutorial.

`AssetInspector.tsx` is deleted once nothing imports it.

**`src/rendering/selection-chip.tsx`** — the world-anchored chip. Lives in `src/rendering` because it
renders inside the `<Canvas>`; this keeps the ui→rendering import direction clean and follows the
existing precedent of R3F components reading `@state` directly (`city-layout.tsx:78`).

- drei `<Html center occlude={false} zIndexRange={[15, 0]}>` — below the console's `zIndex: 20` so a
  chip can never cover a panel.
- Anchor resolution: buildings via `buildingPosition3(id)` (`src/rendering/camera/city-positions.ts:50`);
  buses and generators from `MERIDIAN_BAY_TOPOLOGY`; lines at the midpoint of their two endpoint nodes.
- Content is deliberately three lines — name, status LED + label, one live metric — plus a
  `▸ details` affordance pointing at the rail. Roughly 180px wide, square corners, mono numerals.
- Exactly one chip exists at a time (it reads the single `ui-store.selectedAsset`), so there is no
  clutter and no per-frame allocation.

---

## 7. File-by-file change list

### New (11)

```
src/state/tutorial-store.ts
src/state/tutorial-store.test.ts
src/ui/onboarding/tutorial-steps.ts
src/ui/onboarding/tutorial-steps.test.ts
src/ui/onboarding/DavisPortrait.tsx
src/ui/onboarding/PersonaDialog.tsx
src/ui/onboarding/TutorialManager.tsx
src/ui/onboarding/Reveal.tsx
src/ui/onboarding/index.ts
src/rendering/selection-chip.tsx
src/ui/console/ContextInspector.tsx
```

### Modified (12)

| File                                                        | Change                                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/state/app-flow-store.ts`                               | `CrisisSelect` → `Tutorial`; `enterSimulation` → `beginShift`; `replay()` targets `Tutorial`; update the flow docstring. |
| `src/state/index.ts`                                        | Export the tutorial store + `PanelId`.                                                                                   |
| `src/ui/console/ConsoleShell.tsx`                           | Full restructure per §5.                                                                                                 |
| `src/App.tsx`                                               | `isTutorial`; mount `<TutorialManager />` and `<SelectionChip />`; unmount `<MissionBriefing />`.                        |
| `src/ui/hero/HeroOverlay.tsx`                               | `enterSimulation` → `beginShift`.                                                                                        |
| `src/ui/prefs/demo-driver.ts`                               | `skip()` the tutorial on start; mode check `CrisisSelect` → `Tutorial` (`demo-driver.ts:68`).                            |
| `src/ui/prefs/QuickControls.tsx`                            | Add a "Replay tutorial" chip → `restart()`.                                                                              |
| `src/rendering/camera/CameraDirector.tsx`                   | Intro trigger `mode === CrisisSelect` → `Tutorial` (`CameraDirector.tsx:103`); accept the new P92 tutorial intent.       |
| `src/rendering/camera/camera-store.ts`                      | Document `92 tutorial` in the priority ladder (`camera-store.ts:7-8`).                                                   |
| `src/ui/advisor/AdvisorCard.tsx`                            | 32px Davis portrait + `CHIEF ENG. DAVIS · CH.1` name plate. **No change to advisor logic, evidence, or Gemini calls.**   |
| `src/ui/after-action/AfterActionScreen.tsx`                 | Byline the existing narrative with Davis's portrait + name. **No change to scoring or data.**                            |
| `scripts/visual-audit.mjs`, `scripts/competition-audit.mjs` | Skip the tutorial before asserting; update the `CrisisSelect` step comment (`visual-audit.mjs:46`).                      |

### Deleted (after confirming nothing imports them)

```
src/ui/console/AssetInspector.tsx      → superseded by ContextInspector
src/ui/prefs/MissionBriefing.tsx       → superseded by Davis
src/ui/crisis-select/CrisisSelectScreen.tsx   → unmounted since the §1 flow compression
src/rendering/advisor-drone.tsx        → unmounted; also violates doctrine #3 (glassmorphism, neon)
src/rendering/drone-camera.tsx         → verify unmounted first (CameraDirector owns all camera motion)
```

---

## 8. Testing

**New unit tests (pure, no DOM):**

- `tutorial-store.test.ts` — `begin()` on a completed flag reveals everything and never activates;
  `advance()` walks beats in order and reveals each beat's panel; `skip()` reveals all and persists;
  `restart()` clears the flag and rewinds to beat 0; a throwing localStorage degrades gracefully.
- `tutorial-steps.test.ts` — beat ids are unique; every `PanelId` is revealed exactly once across the
  script; no beat has empty `lines`; every `select-asset` gate carries a fallback id and timeout.
  _This test is what stops a future edit from silently orphaning a panel that then never appears._

**Regression gates — all must hold:**

```
pnpm typecheck          # currently 0 errors — must stay 0
pnpm typecheck:engine   # proves the pure layers still compile with no DOM/React
pnpm test               # currently 395 green — must stay green
node scripts/visual-audit.mjs
node scripts/competition-audit.mjs
```

**Manual verification, recorded as audit evidence:**

1. Fresh profile → tutorial auto-runs, all six panels arrive one at a time in script order.
2. `Skip` on beat 1 → complete console, ScenarioPanel present, run starts normally.
3. Reload → no dialog, straight to the scenario pick.
4. `?demo` → tutorial bypassed entirely, existing demo flow unchanged.
5. Beat 3 left un-clicked for 12s → fallback selects the hospital and the beat proceeds.
6. `prefers-reduced-motion` → panels appear instantly, no slide.
7. Click a line mid-crisis → chip appears at the line, detail in the left rail, no right rail anywhere.

---

## 9. Risks and honest call-outs

1. **The mode rename is the riskiest edit.** `CameraDirector.tsx:103` triggers the 9.5s intro flyover
   on `wasHero && mode === CrisisSelect && !introDone`. If that condition is mis-ported the flyover
   dies silently and the demo loses its opening. Stage 1 ends with an explicit check of this path.
2. **drei `<Html>` costs a DOM node per frame-update and can occlude geometry.** Mitigated by one
   chip at a time, three lines of content, `occlude={false}`, and `zIndexRange` below the console.
   If it measurably costs frames I will fall back to projecting the anchor once per selection rather
   than per frame, and will report the numbers either way.
3. **Interaction gates can stall a live demo.** Hence the 12s fallback on beat 3. It is the only
   gate that depends on the player doing something.
4. **A stale localStorage flag can hide the tutorial from someone who wants it.** Mitigated by the
   versioned key and the "Replay tutorial" control in QuickControls.
5. **Dissolving the right rail reduces simultaneous information density.** Nothing is lost — the
   inspector moves left, Understanding floats bottom-right — but if you'd rather keep a right rail
   for a future panel, say so now; reinstating it later is more churn than never removing it.
6. **~440 pre-existing repo lint errors** remain the baseline. I will not increase that count, and
   new files will be lint-clean, but I am not fixing the backlog as part of this work.

---

## 10. Sequencing — five stages, each independently verifiable

| Stage  | Content                                                                      | Done when                                                                                         |
| ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **S1** | `tutorial-store` + tests; `AppMode.Tutorial` rename across all 9 call sites  | typecheck 0, 395+ tests green, app behaves **exactly as today** with the tutorial force-completed |
| **S2** | `Reveal`; ConsoleShell restructure; `ContextInspector`; Understanding floats | right rail gone, inspect lands in the left rail, panels still all visible (reveal-all)            |
| **S3** | `selection-chip.tsx` in-world                                                | clicking any asset shows the chip **and** fills the rail card                                     |
| **S4** | `DavisPortrait`, `PersonaDialog`, `tutorial-steps`, `TutorialManager`        | full 7-beat tutorial runs, skips, and persists                                                    |
| **S5** | Davis on AdvisorCard + AfterAction; demo/audit scripts; dead-file deletion   | audits PASS, evidence refreshed                                                                   |

Each stage gets `pnpm typecheck && pnpm typecheck:engine && pnpm test` before the next begins. I'll
check in with you after **S2**, since that's the stage where the layout change becomes visible and is
the cheapest point to change direction.

---

## Approval

Reply to start. Flag anything in §3 (flow), §4 (dialogue), or the two §2 layout deviations you want
changed — those are the cheapest things to alter now and the most expensive to alter later.

---

# Execution log — what actually happened

Kept as the record of where reality diverged from the plan above. All five stages shipped.

## Bugs found by building it

1. **The inspect card was invisible.** It rendered with `opacity: 1` at `y: -31`. Chrome's _scroll
   anchoring_ compensates for a 317px card inserted above existing content by scrolling the
   container down by exactly that amount, so clicking a building silently scrolled the answer out of
   view. Fixed with `overflow-anchor: none` plus `scrollIntoView` on selection.
2. **The typewriter was frame-rate dependent.** One character per rendered frame — fine at 60 fps,
   but a 3D scene on a weak GPU stretches frames past half a second, and Davis would still be on his
   first sentence a minute in (measured: 1 char / ~800 ms headless). Rewritten to derive the visible
   character count from _elapsed wall-clock time_, so a late callback catches up several characters
   and a beat takes the same time at 5 fps as at 60.
3. **`?demo` permanently consumed the tutorial.** The demo called `complete()`, which persists — so
   anyone who clicked "Competition Demo" once lost the tutorial for good. Added `skipForSession()`,
   which stands it down for the page load without writing the flag.
4. **The audit had a false-negative threshold.** It reported `AUDIT FAIL` on a healthy run: the
   headless GPU advances ~0.15 sim-seconds per real second, so its 5-second sample yielded <1
   sim-second and rounded below a `>` check. Widened to 15 s.
5. **Two overlay collisions:** `QuickControls` (`bottom: 190`) sat under the relocated
   "Understanding" card, and the camera chip row sat exactly where Davis's dialogue goes.
6. **Zustand v5 makes `renderToStaticMarkup` useless for component tests here.** v5 hands React
   `getInitialState` as the SSR snapshot, so a server render always sees the store's _initial_
   value and reports an empty component no matter what a test sets up. Component tests that depend
   on store state MUST be client renders under jsdom (`// @vitest-environment jsdom` +
   `createRoot` + `act`). Wrap the store write inside `act` too, or a mounted subscriber warns.

## Deviations from the plan

- **Health meanings now collapse after teaching** (with a `?` toggle) and **vitals are pinned** so
  only the lower rail scrolls. Forced by a real overflow: Health (~420px) + Actions (~560px) blew
  past the 676px rail budget once Inspect was added, and vitals scrolled out of view mid-crisis.
- **Camera chips and QuickControls are withheld while Davis teaches** — he hasn't introduced them,
  and they collided with his dialogue. The intro's own captions and Skip control are unaffected.
- **`Reveal` scrolls its panel into view when disclosed.** Without it, Davis said "this is the other
  half" about an Operator Actions panel sitting below the fold.
- **The `actions` / `scenario` rail slot is shared.** During teaching it previews the levers with
  Execute disabled ("These arm the moment your shift starts"); the final beat swaps in the scenario
  picker. Keeps the rail inside its height budget.
- **Three dead files were deleted in S1 rather than S5** (`advisor-drone`, `drone-camera`,
  `CrisisSelectScreen`) — they referenced the renamed mode, and patching dead code to keep it
  compiling was worse than removing it.

## Final verification

| Gate                    | Result                    |
| ----------------------- | ------------------------- |
| `pnpm typecheck`        | 0 errors                  |
| `pnpm typecheck:engine` | 0 errors                  |
| `pnpm test`             | 418 passed (was 395; +23) |
| `visual-audit.mjs`      | PASS, 0 page errors       |
| eslint (new/changed)    | 0 errors                  |

Reduced motion verified separately: every panel reports `transition: 0s` / `animation: 0s`, the
dialogue stays legible, and the tutorial still advances (panels 1 → 2). Zero page errors.

Audit evidence: `docs/superpowers/audit/onboarding-overhaul/` — the before state, the intro flyover
surviving the mode rename, four tutorial beats unlocking their panels, the assembled one-rail
console, the relocated inspector, the world chip, and the reduced-motion pass.
