# Interaction — FROZEN

Interaction in GridGuard is the operator acting on the grid and watching the consequences. Controls are precise instrument affordances; feedback is **consequence-driven, not toast-driven** — you learn your action worked because the grid changed, not because a notification popped. The signature control is the **Decision Wheel**.

---

## The Decision Wheel

A **radial** control for committing grid decisions under pressure. It is the product's most memorable interaction, and it is held to the highest bar.

### Behavior

- **Radial layout** — options arrayed around a center; the operator picks a direction and commits. Fast, spatial, memorable (a **demo moment**).
- **Delta preview** — before commit, the wheel shows the **predicted consequence** of the highlighted option (the change in grid state it would cause). The operator decides with foresight, not blindly. The preview is a projection of simulation prediction, not an invented number.
- **Commit is explicit** — highlight, then confirm. No accidental commits; a decision changes the simulation.
- Opens on `DecisionRequested` (or operator intent); confirming emits `DecisionCommitted`.

### Keyboard operability (mandatory)

Per [`src/ui/accessibility/a11y.ts`](../../src/ui/accessibility/a11y.ts), the Decision Wheel is **fully keyboard-operable**:

| Key            | Action                          |
| -------------- | ------------------------------- |
| **Arrow keys** | Move highlight around the wheel |
| **Enter**      | Commit the highlighted option   |
| **Esc**        | Dismiss without committing      |

- Every option is reachable and committable by keyboard alone — no pointer required.
- Focus is always visible (using the `instrument` accent) and never trapped without an escape.
- The delta preview updates as the highlight moves, by keyboard or pointer alike.

---

## Zone selection

- **Click/tap a zone** in the 3D scene, or select it from the HUD list — both paths select the same zone (pointer and keyboard parity).
- **Selected state** uses the `instrument` accent (see [`color.md`](./color.md)) — a clear, non-status highlight so selection never collides with grid-status color.
- Selecting a zone focuses its telemetry and available decisions. Selection is **inspection**, not commitment — nothing changes in the grid until a decision is committed.
- Keyboard: zones are navigable and selectable without a mouse.

---

## HUD affordances

- **Instrument affordances, not consumer buttons** — controls look like panel controls: hairline-bordered, small radii (2–4px), tabular readouts. (See [`spacing.md`](./spacing.md).)
- **State is legible on every control** — active/inactive/disabled are visually distinct via surface step + ink, not color alone.
- **Discoverable and honest** — an affordance that looks interactive is interactive; static readouts don't masquerade as buttons.
- **Focus-visible everywhere** — keyboard focus is obvious on every interactive element, using the `instrument` accent.

---

## Pointer-events discipline

The 3D canvas and the HUD overlay share the screen; pointer routing must be exact.

- **The canvas stays interactive.** HUD overlay containers that merely frame the scene are `pointer-events: none` so orbit/zoom/pan and zone-picking reach the canvas underneath.
- **Controls re-enable.** Actual interactive HUD elements (panels, the Decision Wheel, buttons) set `pointer-events: auto` on themselves — islands of interactivity over a click-through overlay.
- **No invisible blockers.** A transparent overlay must never silently eat camera or selection input. If the camera feels "dead," suspect a stray `pointer-events: auto` overlay.
- **Clear precedence** — when the Decision Wheel or a modal is open, it owns input; when closed, the canvas and HUD resume normally.

---

## Feedback is consequence-driven, not toast-driven

This is the interaction philosophy in one line.

> **You know your action worked because the grid responded — not because a toast said so.**

| Do                                                                                                                                                        | Don't                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Show the committed decision's effect _in the simulation_ — lines re-color, load shifts, a zone re-energizes, telemetry moves                              | Fire a "Decision saved!" toast and call it feedback      |
| Let event-driven motion/lighting/audio confirm the consequence (see [`motion.md`](./motion.md), [`lighting.md`](./lighting.md), [`audio.md`](./audio.md)) | Stack notification cards for routine actions             |
| Use a brief, proportionate confirm cue for the _act_ of committing                                                                                        | Use decorative success animations or celebratory effects |
| Surface genuine alarms/annunciators for real conditions, that clear when resolved                                                                         | Spam transient popups that pile up and obscure the scene |

- **Toasts are reserved** for rare, out-of-band messages (e.g. a system/connection notice) — never as the primary feedback for grid actions.
- **Consequence over confirmation:** the best feedback that a decision mattered is a visibly changed grid. That is also the **educational** payoff — the operator sees cause → effect.
- All feedback ultimately traces to simulation events, keeping interaction consistent with the whole doctrine: the simulation is the source of truth, and the UI shows what it did.
