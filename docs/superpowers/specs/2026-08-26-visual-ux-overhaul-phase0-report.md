# Phase 0 report — Visual & UX overhaul

**Date:** 2026-08-26
**Status:** approved and executed. See the Appendix for what was built.
**Method:** full read of `src/`, then the live build captured with Playwright at
1366×768, 1600×900 and 1920×1080, plus DOM geometry measurements. Screenshots and
the capture script are in the session scratchpad.

---

## 0. Headline: the brief describes an older build

Six of the seven problems in the brief were written against a build that predates
commit `46184dc feat(ui): persona-driven onboarding and a single-rail console`.
I ran the current build before believing any of them. What I found is a different,
shorter, and more fixable list — but it contains one bug that is worse than
anything in the brief and that the brief does not mention.

Please confirm the screenshots are pre-`46184dc`. If they are, Phase 1 shrinks to
about a fifth of its described size and that budget is better spent on Phase 2.

---

## 1. Already working — do not touch

| Area                                                                    | State                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simulation engine, frequency model, protection, power flow, Monte Carlo | Out of scope by constraint, and healthy                                                                                                                                                                                                                                                                                 |
| **Panel layout architecture**                                           | `ConsoleShell.tsx` is a CSS grid (48px bar / 1fr / 176px timeline; 320px rail). Container is `pointerEvents: none`; only panels opt in. Coherent z-scale already exists: 20 console → 21 understanding → 25 quick-controls → 26 advisor → 30 camera HUD → 40 persona → 50 tour → 60 debug. **Phase 1.1 is ~80% built.** |
| **Advisor "What happened / Why / What you can do"**                     | Fully wired to real data. `EventLogEntry` carries `what`/`why`/`action` as required fields; `LearningFeedback.tsx` renders all three. Not a binding bug.                                                                                                                                                                |
| **Persistent severity chip**                                            | `CommandBar` renders NORMAL / ELEVATED / EMERGENCY / BLACKOUT, colour-coded, with a tooltip. Phase 1.4's severity half is done.                                                                                                                                                                                         |
| **Mission briefing + role framing**                                     | Hero overlay already reads _"You are the grid operator. Keep the city powered through the crisis."_ Plus a full persona tutorial (Davis) with progressive panel reveal. Phase 4.1 is done.                                                                                                                              |
| **Results screen**                                                      | `AfterActionScreen.tsx` — five scored categories, measured decision verdicts, concept mastery bars, run timeline, and a Gemini-or-deterministic narrative. Phase 4.4 is essentially done.                                                                                                                               |
| **Sound design**                                                        | 11 keyed SFX + 3 music stems, all files present in `public/audio/`, each with a procedural fallback tone. **Phase 3.3 is done.**                                                                                                                                                                                        |
| **City density**                                                        | ~60 buildings across 6 districts, already clustered by type, hospital already distinct with a red cross. Roads, parks, pond, trees, pylons, streetlights, coastline, mountains, drifting clouds.                                                                                                                        |
| **Idle life**                                                           | Turbine rotor speed scales with real wind output; window glow follows time-of-day; deterministic 14 Hz flicker on tripped feeders; flow pulses travel corridors in the true _signed_ direction. **Phase 2.6 is done.**                                                                                                  |
| **Camera**                                                              | `CameraDirector` runs frame-delta smootherstep eased flights with a priority queue. A 7-second intro flyover already exists. **Phase 3.1 (easing) and 3.4 (establishing shot) are done.**                                                                                                                               |
| **Time of day**                                                         | Afternoon → dusk → night driven by the sim tick. The night state genuinely looks good.                                                                                                                                                                                                                                  |

---

## 2. Actually broken — verified, with numbers

### B1 · CRITICAL — the operator action panel is 871px tall in a 191px box

Measured `scrollHeight` vs `clientHeight` of the rail scroll container:

| Viewport  | Scroller height | Panel height | **Hidden below fold** |
| --------- | --------------- | ------------ | --------------------- |
| 1366×768  | 191px           | 871px        | **690px**             |
| 1600×900  | 323px           | 871px        | **558px**             |
| 1920×1080 | 503px           | 871px        | **378px**             |

At 1366×768 a player sees **one of five operator levers**. Even at 1080p, three
are invisible. And there is no scroll affordance of any kind: `index.css` defines
a `.console-rail-scroll` class with styled scrollbars and smooth scrolling, but
**it is never applied to anything** — the real scroller at `ConsoleShell.tsx:71`
uses a bare inline `overflowY: 'auto'`. No scrollbar, no fade, no shadow, no
"3 more" hint.

This is the most damaging bug in the build: the primary interaction surface is
mostly invisible on a judge's laptop. It is not in your brief.

### B2 · HIGH — the "Understanding" panel is clipped; this is your "renders empty" bug

`ConsoleShell.tsx:129` hard-codes `maxHeight: 240`. The panel's content measures
**281px** at every viewport. The hidden 41px is exactly the body text of _"What
you can do"_ — the third and most actionable section.

The heading renders, the sentence under it does not. That is what your screenshots
show. The fix is the box, not the data.

### B3 · HIGH — floating 3D labels are fixed-size world text

`grid-scene.tsx:167` renders `<Text fontSize={2.6}>` at `y=20` for every bus:
fixed world size, always on, no billboard, no distance fade, no occlusion. When
auto-follow pushes the camera in, `HB1` / `HB2` / `IN3` become the largest objects
on screen. Your item 4 is real and unfixed.

### B4 · HIGH — the ground is the problem, not the buildings

Three compounding defects, all in `grid-scene.tsx`:

1. **The neon grid.** `gridHelper(180, 18, '#15803d', '#1e3a2b')` uses
   `LineBasicMaterial`, which is **unlit** — it does not dim with `TimeOfDayRig`.
   At night the city goes dark and the green grid stays at full brightness. That
   is the "flat neon wireframe" in your screenshots, and it is a materials fix,
   not a redesign.
2. **The floating slab.** City terrain (220×260 at `y=-0.05`) and far terrain
   (4000×4000 at `y=-0.75`) are two flat planes at different heights and colours.
   Every edge of the city plane is visible from the hero camera — the city reads
   as a card lying on a table.
3. **The razor coastline.** The sea plane meets the far terrain along a perfectly
   straight diagonal with no shore treatment.

### B5 · HIGH — no visual escalation tied to severity

`time-of-day.ts` derives lighting from `tick` alone. Nothing in the render tree
reads weather or the stability state. A Coastal Storm and a calm grid light
identically. No rain, no lightning, no red push.
`rendering/visual-effects/effects-pipeline.tsx` is a 17-line stub; the only
postprocessing is a single Bloom pass declared inline in `App.tsx`.

### B6 · MEDIUM — no cause-and-effect VFX

No spark at the trip point, no ripple on a committed decision, no camera shake.
Zone dimming _is_ already animated (`DimGroup` lerps at `delta * 4.5`, ≈200ms) —
that part of Phase 3.2 is done. The rest is absent.

### B7 · MEDIUM — Davis and Understanding say the same thing at the same time

Captured at T+00:41: the Davis card (top-centre) and the Understanding panel
(right) both render _"Harbor Gas Unit disconnected at T+00:30"_. Two panels, one
fact, simultaneously.

### B8 · MEDIUM — no score/consequence counter, no persistent objective

Grid Health shows `Zones dark: 0` but there is no zones-saved-vs-lost tally. And
the role statement lives only on the hero screen you leave behind — nothing in the
console says what your job is. This is the half of Phase 1.4 / 4.2 that is real.

### B9 · LOW — the After-Action modal doesn't own the screen

It layers above the console, but the left rail and the Understanding panel bleed
through at the edges, and the Run Timeline row is clipped off the bottom of the
viewport at 900px. It needs a true Layer-3 scrim and its own scroll.

### B10 · LOW — three control clusters at three bottom positions

CameraHud chips (bottom-centre, 192), QuickControls (bottom-right, 192), and the
Timeline transport (bottom-left, inside the 176px bar). At 1600×900 the
Understanding panel's bottom edge and the QuickControls row overlap by ~7px.

---

## 3. Could not reproduce

| Brief says                                           | Found                                                                                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Panels overlap; Asset Inspector + Your Mission stack | Those components no longer exist. `46184dc` replaced the two-rail layout with one rail. Measured panel rects at three viewports: **no overlapping panels.** What survives is clipping (B1, B2), not overlap. |
| Advisor panels render empty                          | They render and are truncated. See B2.                                                                                                                                                                       |
| 2–3 scattered assets on empty space                  | ~60 buildings, already clustered by district type, hospital already distinct.                                                                                                                                |
| Blank white/black sky                                | A fog-blended gradient sky that shifts through dusk to night.                                                                                                                                                |
| No narrative/role framing                            | The hero states the role and the tutorial teaches it. What's missing is _persistence into the console_ (B8).                                                                                                 |
| Zone status as flat translucent discs                | Not present. The scattered green dots are the transmission-line flow pulses.                                                                                                                                 |

---

## 4. Where I'd deliberately cut scope

I agree with the Clash-style brief. My read of the captures: **the buildings are
already fine.** Every remaining "prototype" signal comes from the ground, the sky,
the labels, and the absence of state-driven colour.

**Cut:** new building models, higher prop density, satellite/textured terrain,
rain particle systems, any sourced 3D asset.

**Spend on:**

- Killing the unlit gridHelper and unifying the terrain into one lit surface with a
  soft coast (B4) — highest impact per line in the whole project.
- A real gradient sky.
- Distance-faded label chips replacing world text (B3).
- **One severity-driven colour push** that tints sun, fog and bloom toward amber
  and red as stability degrades. ~80 lines, and it is the highest
  drama-per-line change available anywhere in this codebase.
- Storm: skip particles. Lightning as a two-frame directional-light flash plus a
  fog-colour pop reads better than rain sprites and costs nothing.

---

## 5. Proposed restructuring of Phases 1–4

1. **Phase 1 shrinks to four fixes:** rail overflow (B1), Understanding clip (B2),
   Davis/Understanding de-duplication (B7), objective + score line (B8). The layer
   system and severity chip already exist.
2. **Promote B4 and B3 into Phase 1's slot.** They are what makes the build read as
   a debug scene, and they are cheap. A correct ground and faded labels change the
   first impression more than anything in Phase 1 as written.
3. **Delete Phase 3.3 and 3.4 from the plan** — sound hooks and the establishing
   shot are already built.
4. **Phase 4.1 is done.** Phase 4.4 needs only the real-world-lesson paragraph and
   the scrim fix (B9), not a new screen.

Net effect: roughly the same total work, redistributed away from things that are
already finished and toward the ground, sky, labels and severity escalation.

---

## 6. Assets I cannot generate

**None, for the scope above.** Everything recommended is procedural geometry,
materials, shaders and CSS. If you later want textured terrain or building albedo
maps, those must be sourced separately — but I am recommending against them.

---

## 7. How each phase gets verified in isolation

I captured the evidence above with a standalone Playwright script that drives the
real `?demo` flow and writes PNGs at 1366×768 / 1600×900 / 1920×1080, plus a DOM
geometry dump (panel rects, scrollHeight vs clientHeight, overflow detection). It
touches nothing in the app. After each phase I'll re-run it and hand you a
before/after pair at all three viewports, so "did it actually fix the readability
problem" is answered by measurement rather than by my opinion.

---

# Appendix — what was built (approved restructure, executed in full)

Approved 2026-08-26: screenshots confirmed pre-`46184dc`; restructured phase
order; run straight through.

## Measured outcome

| Metric                                  | Before                          | After                              |
| --------------------------------------- | ------------------------------- | ---------------------------------- |
| Operator Actions panel height           | 871px                           | **326px**                          |
| Grid Health panel height                | 323px                           | **270px**                          |
| Content hidden below the fold @1366×768 | 690px                           | **91px**                           |
| …@1600×900                              | 558px                           | **0**                              |
| …@1920×1080                             | 378px                           | **0**                              |
| "Understanding" content clipped         | 41px (all of _What you can do_) | **0**                              |
| Rail scroll affordance                  | none                            | visible scrollbar, reserved gutter |
| Tests                                   | 550                             | **572** (22 new, all green)        |

Both typechecks clean; production build clean.

## Changes

**Layout (B1, B2, B7, B8)**

- `ConsoleShell.tsx` — applied the `console-rail-scroll` class that existed in
  CSS but had never been attached to anything; replaced the hard
  `maxHeight: 240` on the Understanding card with `min(44vh, 380px)`; moved it
  clear of the QuickControls row.
- `index.css` — scrollbar made visible with a stable gutter.
- `GridHealthPanel.tsx` — collapsed vitals now lay out as a two-column
  instrument cluster instead of an eleven-row stack.
- `OperatorActionsPanel.tsx` — levers became an accordion. Collapsed, each row
  keeps the two things that decide the next thirty seconds (the lever and the
  engine's own what-if verdict) and holds them to one line; cost/benefit/risk
  expands on demand. No information removed.
- `LearningFeedback.tsx` — the auto-selected entry stands down while Davis is
  speaking, so the two stop narrating the same event simultaneously.
- `CommandBar.tsx` — standing objective line, and a districts-held counter
  driven by `zonesEverDark`.
- `Reveal.tsx` — accepts `className`.

**Scene (B3, B4, B5)**

- `ground-texture.ts` _(new)_ — survey grid baked into a canvas texture on a
  `MeshStandardMaterial`, so it is **lit** and dims into the night. The old
  `gridHelper` drew with `LineBasicMaterial`, which is unlit — that is why the
  grid stayed at full daylight brightness over a dark city. The texture also
  fades at three edges, dissolving the floating-slab look; the east edge stays
  hard because the ocean overlaps it.
- `grid-scene.tsx` — far terrain recoloured to match the city ground; ridge
  moved from ~300 to 750–1050 units so fog turns cones into a horizon; shore
  band and shallow shelf added at the waterline.
- `atmosphere.tsx` — bay enlarged past the fog plane, and made **opaque and
  diffuse**: as a transparent 3,400-unit plane it was depth-sorted by object
  centre against the shelf and terrain, which produced a hard dark wedge that
  moved with the camera.
- `bus-labels.tsx` _(new)_ — substation chips at constant apparent size that
  fade out on wide shots, replacing fixed-size world text.
- `severity.ts` _(new, tested)_ — pure display mapping from measured frequency
  deviation, corridor loading, dark districts, trips and UFLS stage to a 0..1
  grade. Worst-component, not average.
- `TimeOfDayRig.tsx` — gradient sky dome, and sun/ambient/hemisphere/fog now
  blend toward a crisis palette in proportion to that grade, capped so the time
  of day stays readable underneath.

**Feedback (B6)**

- `event-flashes.tsx` _(new)_ — pooled flash and shock ring at the exact map
  position of every real trip, loss, blackout and restoration.
- `storm.tsx` _(new)_ — lightning while the weather model reports Storm, on a
  tick-derived deterministic schedule. No rain particles, by choice.
- `camera-shake.tsx` _(new)_ — trauma-decay rotation offset on critical events.
  Mounted after CameraDirector and additive-on-rotation only, so it can never
  corrupt the pose the director lerps from. Respects reduced-motion.
- `grid-store.ts` — weather projected so the scene can finally see it.

**Review (B9 + lesson)**

- `real-world-lesson.ts` _(new, tested)_ — pure selection of the grid
  engineering lesson this run earned, from measured facts.
- `AfterActionScreen.tsx` — real modal scrim with blur, bottom padding, and the
  lesson card.

## Bug found and fixed on the way

`CameraDirector` started the intro by watching for the Hero → Tutorial
_transition_ through a previous-mode ref. That silently assumed the component
was mounted before the mode changed — but it lives inside `<Canvas>`, and R3F
mounts canvas children only after the WebGL context exists. On a slow first
frame the mode was already Tutorial when the effect first ran, the edge was
never observed, and the intro never played; `?demo` then waited forever on an
`introDone` that could not arrive. Reproduced reliably once the scene got
heavier. Now driven by state rather than by an edge.

## Not done, and why

- **Gentle idle camera drift** (brief Phase 2.6). Frozen doctrine forbids
  animation without a traceable simulation cause; drift has none.
- **Rain particles** (brief Phase 2.3). Scoped out in favour of lightning.
- **91px still below the fold at 1366×768.** Closing it needs the vitals panel
  to collapse further at short viewports. It now has a visible scrollbar.
