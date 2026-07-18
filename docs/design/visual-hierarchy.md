# Visual Hierarchy — FROZEN

The screen has a **reading order**, and it holds whether the grid is calm or collapsing. Emphasis is spent deliberately — the instrument accent and semantic status colors draw the eye to what matters, and everything else stays quiet so those signals land. The console is calm until crisis, and the hierarchy is what makes crisis unmissable.

---

## Reading order (highest → lowest priority)

| Rank | Element                       | Why it's here                                                                                                                                       |
| ---- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Crisis banner / countdown** | Time pressure and the top-line crisis state — the one thing the operator must never miss. Most prominent position, largest readout (mono, tabular). |
| 2    | **Zone alerts**               | Which parts of Meridian Bay are in trouble, ranked by severity. The "where do I act" layer.                                                         |
| 3    | **Telemetry**                 | The measured detail behind the alerts — loadings, flows, margins. The "what exactly is happening" layer.                                            |
| 4    | **Chrome**                    | Persistent controls, settings, legend, replay/timeline — always available, never competing for attention.                                           |

Layout places elements by this order (see [`spacing.md`](./spacing.md)): rank 1 gets the most prominent, most stable position; chrome recedes to the edges. Reading order is stable — panels don't reshuffle as data updates.

---

## How emphasis is created

Emphasis is a **budget**, spent sparingly:

| Tool                      | Used for                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Semantic status color** | Grid conditions climbing the severity ladder (see [`color.md`](./color.md)) — the primary way crisis pulls the eye |
| **`instrument` accent**   | Selection, focus, the active/live element the operator is working with                                             |
| **Size & weight**         | The countdown and primary KPIs are larger; labels are small (see [`typography.md`](./typography.md))               |
| **Position**              | Higher-priority elements sit in more prominent, stable regions                                                     |
| **Event-driven motion**   | A newly critical element earns a caused motion cue (see [`motion.md`](./motion.md)) — never idle motion            |

What is **not** used for emphasis: gradients, glows, drop shadows, large radii, decorative animation (all forbidden — see [`visual-language.md`](./visual-language.md)). Emphasis is earned by meaning, not by ornament.

---

## Calm vs crisis — what draws the eye

The hierarchy has two modes, and the contrast between them is the drama.

### Calm (grid nominal)

- Predominantly `status.nominal` and graphite; the screen is quiet and even.
- The eye rests on the **telemetry** — the operator is monitoring, scanning steady readouts.
- No motion, no alarms, minimal audio (see [`audio.md`](./audio.md)). The countdown/banner is present but subdued.
- **Nothing shouts.** This is deliberate — a calm baseline gives crisis somewhere to escalate to.

### Crisis (grid stressed / cascading)

- The eye is **pulled up the hierarchy**: the crisis banner/countdown and the highest-severity zone alerts dominate.
- Semantic color climbs the ladder (caution → warning → critical) on the affected elements, and **only** those elements — the rest stays graphite so the hot spots are unmistakable.
- Caused motion, lighting, and audio converge on where the failure is (see [`motion.md`](./motion.md), [`lighting.md`](./lighting.md), [`camera.md`](./camera.md)).
- Telemetry is still there for detail, but attention is **directed** to the crisis first, detail second.

> **Protect the calm so the crisis reads instantly.** If everything is emphasized, nothing is — a noisy calm state destroys the escalation that makes GridGuard land as a crisis simulator.

---

## Rules

1. **One thing leads at a time.** At any moment there is a clear single most-important element (calm: the steady console; crisis: the top alert/countdown). Don't create competing focal points.
2. **Status color is the crisis pointer** — reserve it for real conditions so it always means "look here" (see [`color.md`](./color.md)).
3. **The accent marks the operator's focus** — selection/live element only; it never competes with status color for the crisis signal.
4. **Restraint by default** — most of the screen is quiet graphite most of the time. Emphasis is the exception, not the texture.
5. **Never color alone** — the hierarchy is reinforced by position, size, icon, and label so it survives color-vision differences and holds up in every state (accessibility, per [`src/ui/accessibility/a11y.ts`](../../src/ui/accessibility/a11y.ts)).
