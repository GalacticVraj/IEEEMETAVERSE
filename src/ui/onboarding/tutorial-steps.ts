/**
 * tutorial-steps.ts — the persona's script. Pure data, no React, no side
 * effects, so the ordering guarantees are unit-testable.
 *
 * VOICE: Chief Engineer Davis, nineteen years on the desk. Warm, unsentimental,
 * short sentences. He explains what a control means and what it costs — never
 * marketing copy.
 *
 * TRUTHFULNESS (doctrine #1/#2): every claim here is qualitative and true of
 * the real simulation. Davis points at live readouts; he never quotes a number
 * the engine has not produced. If you edit a line, it must stay true of the
 * engine's actual behaviour, not of what would sound good.
 */
import type { PanelId } from '@state';

/** What must happen before the tutorial moves on. */
export type BeatGate =
  /** Player presses the dialogue's continue button. */
  | { readonly kind: 'next' }
  /**
   * Player must select something in the 3D city. `fallbackMs` later the
   * manager selects `fallbackAssetId` itself and moves on — an interaction
   * gate must never be able to freeze a live demo.
   */
  | {
      readonly kind: 'select-asset';
      readonly fallbackMs: number;
      readonly fallbackAssetId: string;
    };

export interface TutorialBeat {
  readonly id: string;
  /** Drives the portrait's expression. */
  readonly mood: 'neutral' | 'focused' | 'grave' | 'approving';
  readonly lines: readonly string[];
  /** Panel disclosed when this beat STARTS. Omit for beats that reveal nothing. */
  readonly reveals?: PanelId;
  readonly gate: BeatGate;
  /** Label for the continue button when the default doesn't fit. */
  readonly cta?: string;
}

const NEXT: BeatGate = { kind: 'next' };

export const TUTORIAL_BEATS: readonly TutorialBeat[] = [
  {
    id: 'arrival',
    mood: 'neutral',
    reveals: 'command',
    lines: [
      "Meridian Bay control room. I'm Davis, chief engineer — nineteen years on this desk.",
      'That city out there is yours for the next shift. Every light in it runs on power we push down those lines.',
      "Let me show you the desk. Won't take long.",
    ],
    gate: NEXT,
  },
  {
    id: 'vitals',
    mood: 'focused',
    reveals: 'health',
    lines: [
      'First thing any operator checks: vital signs.',
      "Demand is what the city is pulling. Generation is what we're making. When Balance goes negative we're borrowing from physics — and physics always collects.",
      'The one that ends careers is Corridor stress. At a hundred percent, protection drops the line to save the hardware. That is not a warning. That is the grid deciding without you.',
    ],
    gate: NEXT,
  },
  {
    id: 'inspect-prompt',
    mood: 'neutral',
    lines: [
      'Those numbers are the whole city at once. When you need one building, ask it directly.',
      "Go on — click something out there. The hospital's a good place to start.",
    ],
    gate: { kind: 'select-asset', fallbackMs: 12_000, fallbackAssetId: 'DT-Hosp' },
    cta: 'Click a building in the city',
  },
  {
    id: 'inspect-explain',
    mood: 'focused',
    reveals: 'inspect',
    lines: [
      'There it is — a tag right where you clicked, and the detail over here beside your controls.',
      'Every building carries a priority tier. Tier one never goes dark. That is not my preference, that is the law.',
      'Get in the habit of asking the city questions before you act on it.',
    ],
    gate: NEXT,
  },
  {
    id: 'levers',
    mood: 'grave',
    reveals: 'actions',
    lines: [
      'Knowing is half the job. This is the other half.',
      "Every lever costs something. Cut cooling, people sweat. Pause EV charging, someone's late for work. Shed a district and you turn the lights off on purpose.",
      'There is no free move. Read the cost, the benefit and the risk — then commit early. Late is worse than imperfect.',
    ],
    gate: NEXT,
  },
  {
    id: 'record',
    mood: 'neutral',
    reveals: 'timeline',
    lines: [
      'The grid keeps its own log. Every trip, every recovery, timestamped.',
      "Click any marker and I'll tell you what happened, why, and what you could have done instead.",
      'That is how operators get better. Not from me lecturing — from the record.',
    ],
    gate: NEXT,
  },
  {
    id: 'handoff',
    mood: 'approving',
    reveals: 'scenario',
    lines: [
      'That is the desk. Pick your crisis.',
      "Heatwave's the one I'd start with. It builds slow enough to think.",
      "I'll be on channel one all shift. Good luck, operator.",
    ],
    gate: NEXT,
    cta: "I'm ready",
  },
];
