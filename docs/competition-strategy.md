# GridGuard — Competition Strategy

> **This document keeps future development aligned with how GridGuard is judged.**
> The [Experience Doctrine](./experience-doctrine.md) protects the _identity_. This document protects the _score_. They must never contradict — a feature that wins points but betrays the fantasy is a net loss, and a feature that serves the fantasy but earns no evidence is a luxury we ration.

**Operating principle:** in a hackathon, a **tight, deep, provable** build beats a broad, shallow one. Engineering realism and judging evidence beat feature count. Every hour spent must convert into something a judge can _see, feel, or verify_.

---

## 1. The Five Feature-Value Pillars — as a Scoring Lens

Every feature is scored against these before it earns a place. This is the same five-pillar lens from the foundation spec, read as a rubric.

| Pillar                      | The judge question it answers           | How we earn it                                                                                                                                                   |
| --------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engineering credibility** | "Is this real, or a demo trick?"        | Deterministic seeded simulation, six-system architecture on a kernel, clean import boundaries, real physics behavior. The sim compiles with React/Three deleted. |
| **Educational impact**      | "Did the player actually learn?"        | The Learner Digital Twin, before/after numbers, weak-concept tagging, consequence-driven decision loop.                                                          |
| **Simulation realism**      | "Does this behave like a grid?"         | Powerflow, cascade, protection, restoration, Monte Carlo variance, EIA-calibrated constants. No two runs identical.                                              |
| **Memorable demo moments**  | "Will judges remember this in an hour?" | The blackout cascade rolling across the skyline; the city holding; the Twin proving growth.                                                                      |
| **Judging evidence**        | "Can we prove every claim?"             | Real EIA grounding, deterministic replay, measurable mastery, auditable decision log, clean architecture docs.                                                   |

---

## 2. "Does This Feature Earn Its Place?" — The Checklist

Run this before starting any new feature. **A feature that cannot check box 1 does not get built.**

- [ ] **Pillar test:** Does it strengthen **at least one** feature-value pillar? _(If no → cut it.)_
- [ ] **Fantasy test:** Does it deepen "Grid Operator, Shift One, in a heatwave"? _(If it fights the fantasy → cut it, even if it scores.)_
- [ ] **Causality test:** Does every visible effect trace to a simulation cause? _(No decorative animation.)_
- [ ] **Source-of-truth test:** Does it consume simulation state without computing, caching, or mutating it?
- [ ] **Visual-language test:** Does it fit the frozen engineering-console language? _(No glassmorphism, neon, oversized rounded cards, decorative gradients, generic AI-dashboard look.)_
- [ ] **Evidence test:** After this ships, is there something new a **judge can see, feel, or verify**? _(If it produces no evidence and no felt moment → it is polish; schedule it last or cut it.)_
- [ ] **Cost test:** Is the demo-value-per-hour higher than the next item on the backlog? _(Depth over breadth.)_

> **Tie-breaker rule:** when two features pass, build the one that produces a **memorable demo moment or judging evidence** first. Those are the pillars that convert directly to score in a live judged run.

---

## 3. The Demo Narrative — A 3–5 Minute Judged Run

The demo is a **story with a spike**, not a feature tour. Rehearse it as a single unbroken arc. Every phase below maps to pillars we want the judge to feel in that moment.

**Act 0 — Setup (~30s).** Cinematic open swoops into Meridian Bay. The living skyline breathes with real load. The advisor drone sets the scene: _"Grid's stable, Operator. Forecast's ugly though."_ Establish that **every window is live telemetry**, not a texture.

> _Lands: engineering credibility, simulation realism._

**Act 1 — Rising tension (~60s).** Crisis banner + countdown. Temperature ramps. Tension percussion fades in. Zones slide from normal → warning. The operator makes the first read-and-decide on the Decision Wheel, and the **predicted delta previews before commit**.

> _Lands: causality is visible, tension paced like a game._

**Act 2 — Crisis / cascade (~60–90s).** A zone crosses critical. The operator is forced into a real trade-off — save the commercial block by starving another. If they misjudge it: **hit-stop, screen shake, sub-bass hit, camera push-in, the blackout cascade rolls across the skyline in real time**, the hospital's emergency beacon fires. This is the moment the judges will remember.

> _Lands: consequence is felt not told — the single highest-value demo moment._

**Act 3 — The save or the loss (~30s).** Either the operator stabilizes and the timer expires with the city intact (resolution sting, music resolves, the skyline holds) — or a zone is lost and the advisor reframes it calmly: _"That's a real trade-off. Let's see why."_ **Both outcomes are demo-worthy** — losing is a teaching moment, not a fail state.

> _Lands: the city is real, humane tone, educational impact._

**Act 4 — After-action report (~45s).** The Twin's **before/after numbers** vs. the previous attempt — decisions made, blackouts caused, zones saved, decision time, understanding score. The auditable decision log. The equity insight computed against real EIA calibration. Close by stating: _this is deterministic — we can replay this exact run and prove every number._

> _Lands: mastery is measurable, judging evidence — the payload for the "effectiveness of learning" criterion._

**Rehearsal rules:**

- Always run a **win** and a **loss** back-to-back in prep — the before/after Twin delta is the strongest single piece of evidence, and it needs two attempts to exist.
- Never narrate what the judge can see. Let the blackout land in silence.
- If a demo minute doesn't map to a pillar, cut it from the run.

---

## 4. What Makes a Memorable Demo Moment

Three moments carry the whole judged run. Protect them above all else. Budget polish toward these before anything else.

1. **The blackout cascade.** The skyline going dark in real time — hit-stop, shake, camera push-in, sub-bass, hospital beacon. This is the "consequence is felt" pillar made visible in one shot. **This is the moment the demo is built around.**
2. **The city holding.** The countdown hits zero with the grid intact, the music resolves, the lights stay on. The exhale. It only reads as a victory because the loss was made to feel real first.
3. **The Twin proving growth.** Two attempts, side by side, numbers moving in the right direction. This is what turns "it's a cool sim" into "the player measurably learned" — the difference between a tech demo and an educational tool.

**A moment is memorable when it is:** felt in the body (not read), traceable to real simulation cause (not scripted theater), and unique to this run (Monte Carlo variance + determinism means it is both surprising and reproducible).

---

## 5. Anti-Scope-Creep Rules

The failure mode of a hackathon is a wide, shallow, half-working build. These rules exist to prevent it.

- **Depth over breadth.** One crisis scenario that is deep, deterministic, and cinematic beats five shallow ones. Polish the heatwave until it is undeniable before adding a second scenario.
- **Engineering realism + judging evidence beat feature count.** A judge remembers one credible, felt, provable system longer than ten features they didn't have time to see.
- **Every new system must strengthen a pillar** (§1). A feature that strengthens none is scope creep by definition — cut it.
- **No feature that betrays the fantasy or the visual language, regardless of score.** No generic AI dashboard, no glassmorphism, no neon, no decorative gradients — even if it would be faster or flashier.
- **The three demo moments are frozen priorities.** Polish flows to §4 before it flows anywhere else. A more beautiful settings panel does not beat a more felt blackout.
- **New scenarios extend, never modify, the engine core** (plugin `ICrisisScenario`). If a feature requires touching the kernel to hit a deadline, the feature is wrong, not the kernel.
- **If it produces no evidence and no felt moment, it is polish** — schedule it last, and be willing to cut it when time runs short.
- **Time-box exploration.** If a feature can't demonstrate its pillar value within its box, it is cut, not extended.

---

## 6. Evidence to Surface for Judges

Every claim we make must be backed by something a judge can verify on the spot. Prepare each of these to be shown, not just stated.

| Claim                                               | Evidence to surface                                                                                                                                                                   | Backing pillar                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| "It's grounded in reality."                         | Real **EIA Open Data** cached at build time; equity insights computed against live calibration, not authored numbers. Show the source year and the real disparity.                    | Simulation realism · judging evidence      |
| "It's reproducible, not smoke and mirrors."         | **Deterministic seeded simulation + replay** — same seed reproduces the exact run. Offer to replay the demo and hit the same result.                                                  | Engineering credibility · judging evidence |
| "The player actually learned."                      | **Learner Digital Twin** before/after numbers + auditable **decision log** timeline. Every score traces to a logged decision.                                                         | Educational impact · mastery is measurable |
| "It's real engineering, not a UI mockup."           | **Clean six-system architecture on a kernel**; the simulation compiles with React/Three/UI deleted (`typecheck:engine`); enforced import boundaries; architecture docs with diagrams. | Engineering credibility                    |
| "It behaves like a grid, not a scripted animation." | Powerflow / cascade / protection / restoration behavior + Monte Carlo variance — no two runs identical, yet every effect traces to a simulation event.                                | Simulation realism · causality is visible  |

**Rule of thumb:** if you cannot demonstrate the evidence live in under 20 seconds, prepare a screen-recorded fallback — but never claim what you cannot show.

---

## 7. The Alignment Check

Before merging any feature, one final question:

> **"When we demo this, which pillar does the judge feel — and can I prove it?"**

If you can't name the pillar and the proof, the feature isn't ready. Build the evidence, or cut the feature.

_See also: [`experience-doctrine.md`](./experience-doctrine.md) for the identity these priorities exist to defend._
