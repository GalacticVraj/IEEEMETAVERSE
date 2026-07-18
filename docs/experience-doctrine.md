# GridGuard — Experience Doctrine

> **This is the project's identity. It is the north star.**
> Every feature, effect, sound, number, and line of code is checked against this document before it ships. If a proposed addition does not serve the fantasy and the pillars below, it does not belong in GridGuard — no matter how impressive it is in isolation.

**Thesis: Learning Through Consequence.** Take the power grid — a subject nobody has ever made feel urgent — and make it feel urgent, then prove the player measurably understood it.

---

## 1. The Fantasy

You are **Grid Operator, Shift One**, in **Meridian Bay** — a mid-size coastal city — on the day a **record heatwave** hits.

You are not reading about a grid. You are standing over one. A living 3D skyline stretches out below you, and **every window's glow is real telemetry** from the electrical simulation. A countdown ticks. An AI advisor drone hovers at your shoulder — calm now, urgent soon. Temperature climbs. Load climbs with it.

You intervene:

- **Cut AC** to a commercial block.
- **Activate solar reserves** while the sun still gives you irradiance to spend.
- **Delay EV charging** to buy headroom.

And the city answers — visibly, audibly. Lights dim or steady. A transformer sparks and a block goes dark. A siren wails over a hospital that **must never lose power**.

- **Get it wrong** and the consequence is not a red error toast. It is **a blackout rolling across the skyline in real time** — cinematic, audible, felt.
- **Get it right** and the city holds, the music resolves, and a **Learner Digital Twin** proves — with numbers — that you understood something you did not understand five minutes ago.

Meridian Bay is grounded in **real EIA energy data**. Its price disparities, renewable share, and recovery behavior are not scripted for drama — they reflect the real world. That is what makes the ethics narrative land instead of lecture.

---

## 2. What The Player Feels — The Arc

The whole run is paced as a single emotional curve. Every system serves this arc; nothing is allowed to flatten it.

| Beat            | Feeling                                                       | How it is delivered                                                                                                                                                 |
| --------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Calm**        | Competent, in control, curious                                | Cinematic open, stable city breathing softly, advisor relaxed ("Grid's stable, Operator. Forecast's ugly though."), ambient pad only. Free to inspect, no pressure. |
| **Rising**      | A pit forming, the clock mattering                            | Crisis banner + countdown appears, temperature ramps, tension percussion fades in, first zones cross into warning. The advisor stops waiting to be asked.           |
| **Crisis**      | Adrenaline, hard trade-offs, real stakes                      | Zones hit critical (red pulse), crisis theme takes over, camera tightens, decisions carry weight. Save one block by starving another.                               |
| **Consequence** | The gut-drop of a cascade — or the exhale of holding the line | Blackout: hit-stop, screen shake, sub-bass hit, camera push-in, the skyline goes dark. Or: the timer expires intact, resolution sting swells, the city stays lit.   |
| **Resolution**  | Understanding, not just a score                               | After-action report. The Twin shows before/after. The advisor reframes calmly — even a loss becomes a lesson: "That's a real trade-off. Let's see why."             |

**The felt truth we are protecting:** tension that a form can never produce, and a consequence that a state flag can never sell.

---

## 3. The Five Experience Pillars

Every system must serve at least one. Most great features serve several.

### 1. Causality is visible

Every number changes something you can **see**, not just a label. Load ratio drives window emissive intensity and color. A decision's predicted delta previews on the wheel before you commit. A blackout is the grid's math made spatial. **No number lives only in a readout.**

### 2. Tension is paced like a game, not a form

Countdowns, escalating adaptive music, camera drama, the drone shifting from calm to urgent. The experience has a beginning, a middle, and a spike — not a static panel you fill out. **Pacing is a feature, not decoration.**

### 3. Consequence is felt, not told

A blackout is a **cinematic event**: hit-stop, screen shake, camera push-in, sub-bass hit, the skyline darkening in real time, the hospital's emergency beacon. Never a red toast, never a modal, never a log line. **If it matters, you feel it in your chest.**

### 4. The city is real

Real **EIA Open Data** grounds the simulation constants and the ethics narrative. Recovery multipliers reflect real regional price disparity. Solar backup reflects real renewable share. Equity insights are computed against live calibration, not authored for effect. **The disparity is real, so the lesson is real.**

### 5. Mastery is measurable

The **Learner Digital Twin** proves improvement with numbers, every run — decisions made, blackouts caused, zones saved, decision time, understanding score, weak-concept tags, equity awareness. Shown live mid-session and in the after-action report. **We prove the player learned; we never merely claim it.**

---

## 4. Learning Through Consequence — The Thesis

This is not a game with a lesson bolted on. The learning **is** the consequence loop.

- The player is never lectured. They are handed authority and a ticking clock.
- Every decision previews its consequence, commits, and then shows its **actual** outcome — so the loop teaches rather than punishes blindly.
- Getting it wrong is not failure. It is the most memorable teacher in the build — a cascade you caused, that you can replay and understand.
- The Twin closes the loop by proving, in numbers, that understanding rose between attempts.

**Deterministic replay** means the player can re-run and audit exactly why the grid did what it did. Consequence you can rewind is consequence you can learn from.

---

## 5. Tone

**Tense, credible, humane.** A real operator's console under pressure — not a game menu, not a marketing dashboard.

- **Tense:** the clock is real, the stakes are real, the music knows it.
- **Credible:** engineering realism over decoration, always. Real data, real physics behavior, real trade-offs. Nothing that an actual grid engineer would roll their eyes at.
- **Humane:** the hospital that must never go dark. The low-income zone that recovers slower because of real price disparity, not a scripted penalty. The advisor who reframes a loss as a lesson. We are simulating a city full of people, and the experience respects that.

The player should feel like a professional trusted with something that matters — not a user completing a task.

---

## 6. Non-Negotiable Directives

These are frozen. They are the acceptance lens for every future phase.

1. **The simulation is the single source of truth.** Rendering, UI, audio, replay, analytics, and any future AI are **consumers only**. They may never compute, infer, cache, or mutate authoritative simulation state.
2. **Every visual effect must have a traceable simulation cause.** No decorative or arbitrary animation. If a pixel moves, a simulation event caused it.
3. **The visual language is frozen: a premium engineering operations console** — SCADA systems, industrial control rooms, NASA Mission Control, high-end simulation software.
   - **Forbidden:** generic AI dashboards · glassmorphism · neon cyberpunk · oversized rounded cards · decorative gradients.
4. **Engineering realism beats visual decoration** whenever the two conflict.
5. **Every future feature must strengthen at least one feature-value pillar:** engineering credibility · educational impact · simulation realism · memorable demo moments · judging evidence.

---

## 7. The One-Line Test

Before building anything, answer this:

> **"Does this deepen the fantasy of being Grid Operator, Shift One, in a heatwave — and can I trace it back to a pillar and a simulation cause?"**

If yes, build it well. If no, cut it — no matter how cool it looks.

_See also: [`competition-strategy.md`](./competition-strategy.md) for how this identity is defended against the judging rubric._
