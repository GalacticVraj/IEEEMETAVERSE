# Camera — FROZEN

The camera is a **calm operator's viewpoint over Meridian Bay**, not a cinematic show reel. It supports readable, deliberate inspection of the grid, and it moves on its own only when the director (an event) has a reason to direct attention. Readability is modeled on **Cities: Skylines** — an orbit/zoom city view where you always understand where you are.

---

## Two modes

| Mode                | Driver                             | Purpose                                                       |
| ------------------- | ---------------------------------- | ------------------------------------------------------------- |
| **Operator orbit**  | User input                         | Free inspection: orbit, pan, zoom around Meridian Bay at will |
| **Cinematic tween** | Director / simulation event (GSAP) | Directed move that frames where the crisis is happening       |

The user is always in control by default. Cinematic tweens are occasional, purposeful interruptions that hand control back cleanly when done.

---

## Operator orbit

- **Orbit + zoom + pan**, Cities: Skylines-style — the mental model of a city planner over a map.
- **Constrained** to keep the city readable: clamp pitch (no going under the ground plane or fully top-down unless intended), clamp zoom (city stays legible — not so far it's a dot, not so close you lose context), soft-bound pan to the bay.
- **Smooth, damped input** — momentum/inertia that settles; never twitchy, never floaty.
- **Predictable framing** — the horizon stays sensible, the coast reads, the grid topology stays comprehensible from the default angle.

---

## Cinematic tweens — fired by the director

Cinematic camera moves are **events, not idle behavior.** A director reacts to simulation events and, when warranted, tweens the camera to frame the action.

| Fired by                               | Camera intent                                                           |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `CascadeStarted` / `CascadeStep`       | Move to frame the failing corridor so the operator sees the propagation |
| `ZoneBlackout`                         | Settle on the darkened zone                                             |
| Crisis onset (`Pre-Crisis` → `Crisis`) | Establish the affected area                                             |
| After-Action / recap                   | A composed review move over what happened                               |
| `DecisionCommitted` (major)            | Optionally frame the consequence                                        |

Rules for cinematic moves:

- **GSAP timelines** (see [`motion.md`](./motion.md)): smooth ease-in-out, 600–1500ms, no overshoot.
- **Motivated** — every move answers "the operator needs to look here because _this event_ happened."
- **Return control** — after the move, hand orbit back to the user; don't trap them in a scripted path.
- **Interruptible** — user input cancels or overrides a cinematic move; the operator is never a passenger against their will.

---

## No gratuitous movement

| Forbidden                                                  | Why                                       |
| ---------------------------------------------------------- | ----------------------------------------- |
| Idle orbit / auto-rotate when nothing is happening         | No simulation cause; it's a screensaver   |
| Bobbing, sway, handheld shake for "cinematic feel"         | Decorative motion; hurts readability      |
| Dramatic swoops with no event behind them                  | Show-reel, not instrument                 |
| Rapid cuts / jarring snaps                                 | Disorients; breaks the calm-operator feel |
| Camera moves that obscure the telemetry the operator needs | Function lost to flourish                 |

The resting camera is **still**. If nothing in the simulation calls for a move, the camera does not move.

---

## Framing Meridian Bay

- **Default establishing frame:** a three-quarter orbit angle that shows the coastline, the city grid, and the key substations/corridors in one legible read — the "you are the grid operator" shot.
- **The city is the stage;** UI chrome docks to the edges and frames it (see [`spacing.md`](./spacing.md)), never buries it.
- **Legibility over spectacle:** the frame that best communicates grid state wins over the frame that looks most dramatic. When they conflict, readability wins (engineering realism beats decoration).
- **Consistent up/orientation** so the operator keeps their bearings across cinematic moves — coming out of a tween, the world should still make spatial sense.

---

## Accessibility & comfort

- Respect `prefers-reduced-motion`: reduce cinematic tween intensity or cut to the target frame instead of sweeping.
- Avoid fast field-of-view changes and rapid rotation that can cause discomfort.
- Nothing critical is conveyed by camera motion alone — the simulation state is always readable in the HUD (color + icon + label + value) regardless of where the camera is.
