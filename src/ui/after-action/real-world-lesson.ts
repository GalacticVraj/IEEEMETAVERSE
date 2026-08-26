/**
 * real-world-lesson.ts — the one paragraph that connects THIS run to how
 * power systems actually work.
 *
 * The after-action review already proves what happened, in measured numbers.
 * What it could not do was say why any of it matters outside Meridian Bay. A
 * player who sheds 78 MW of air-conditioning and watches frequency recover has
 * just performed demand response; nothing on screen told them that is a real
 * thing real operators do, under that name, for that reason.
 *
 * The selection is a pure function of measured run facts, so the lesson a
 * player gets is always the lesson their own run earned. The copy is
 * conceptual grid engineering — the mechanisms and the terms of art — not
 * claims about specific incidents, because the run cannot evidence those.
 *
 * Ordered most-specific-first: the first rule that matches wins, so the
 * loudest thing that happened is the thing that gets explained.
 */

export interface LessonInput {
  /** True if under-frequency load shedding fired at any point. */
  readonly uflsFired: boolean;
  /** Districts that lost power at any point in the run. */
  readonly zonesDarkened: number;
  /** Protection operations — lines opened by relays. */
  readonly lineTrips: number;
  /** Worst corridor loading observed, 0..1. */
  readonly peakCorridorStress: number;
  /** Mean renewable share of generation, 0..1. */
  readonly renewableShare: number;
  /** Operator interventions that measurably improved the grid. */
  readonly improvedDecisions: number;
  /** Total operator interventions committed. */
  readonly totalDecisions: number;
  /** Did the grid survive the shift? */
  readonly held: boolean;
}

export interface RealWorldLesson {
  readonly title: string;
  readonly body: string;
}

const LESSONS: readonly {
  readonly when: (input: LessonInput) => boolean;
  readonly lesson: RealWorldLesson;
}[] = [
  {
    when: (i) => i.uflsFired,
    lesson: {
      title: 'Under-frequency load shedding is the grid’s last automatic defence',
      body: 'Relays disconnected load without asking you, because by then there was no time to ask. Every large interconnection runs a scheme like this: when frequency falls past staged thresholds, protection sheds blocks of demand automatically to stop the fall before generators start dropping off to protect themselves. It works, and it is always a failure of everything upstream of it — an operator’s real job is to close the supply gap early enough that the scheme never has to arm. The load you shed by choice is measured in megawatts; the load the relays shed for you is measured in neighbourhoods.',
    },
  },
  {
    when: (i) => i.zonesDarkened > 0,
    lesson: {
      title: 'Not all load is equal, and outages are allocated on purpose',
      body: 'A district went dark this run. Real control rooms plan for that: load is ranked by priority, with hospitals, water treatment and emergency services on feeders that are shed last or not at all, and rotating outages spread the burden so no single community carries the whole shortfall. That ranking is an engineering decision with an equity consequence, which is why it is set by regulators and published in advance rather than improvised during the event. The question is never whether shedding hurts — it is who it hurts, and whether that was chosen deliberately before the night it mattered.',
    },
  },
  {
    when: (i) => i.lineTrips > 0 || i.peakCorridorStress >= 0.95,
    lesson: {
      title: 'Cascades happen because a tripped line does not take its power with it',
      body: 'When protection opens an overloaded corridor, the power it was carrying does not disappear — it redistributes over whatever paths remain, and those paths are now carrying more than they were designed around. That is the mechanism behind essentially every large blackout on record: one element out, its neighbours overloaded, their relays operate, and the failure propagates faster than any human can respond. It is also why operators run to the N-1 criterion, holding enough margin that the system survives losing its single largest element without a second trip.',
    },
  },
  {
    when: (i) => i.improvedDecisions > 0,
    lesson: {
      title: 'You just ran demand response — and it is now cheaper than building plant',
      body: 'Trimming air-conditioning, pausing EV charging and dimming commercial lighting are not improvisations; they are demand response, an established resource that utilities contract for and pay real money to hold available. It works because the balance the grid has to keep is instantaneous, and a megawatt not consumed is worth exactly as much as a megawatt generated — while arriving in seconds instead of the years a peaking plant takes to build. The comfort cost you paid buys the system time, which during a peak is the scarcest thing it has.',
    },
  },
  {
    when: (i) => i.renewableShare >= 0.25,
    lesson: {
      title: 'Wind and solar shift the problem from energy to inertia',
      body: 'Solar panels and wind farms connect through power electronics, not through spinning mass synchronised to the system. They deliver energy without contributing the rotational inertia that slows frequency down when a generator is lost — which is why the same fault produces a much steeper rate of change of frequency on a high-renewable grid than on a thermal one. The engineering answer is not less renewable generation; it is fast-acting replacements for what the spinning mass used to provide: grid-forming inverters, batteries responding in milliseconds, and synchronous condensers.',
    },
  },
  {
    when: (i) => i.totalDecisions === 0,
    lesson: {
      title: 'An unmanaged grid is not a stable grid — it is a lucky one',
      body: 'You made no interventions, and the system was held together by automatic controls: governors adjusting output on every online machine, protection standing by, reserve carried in case the largest unit disconnected. Those controls are genuinely good, and they are also designed on the assumption that a control room is watching and acting on the slower problems they cannot see — the ones that build over minutes rather than seconds. Reserve margin, unit commitment and load forecasting are all decisions made hours ahead by people, and no amount of fast automation substitutes for getting them right.',
    },
  },
];

/** The fallback: a clean, uneventful, well-run shift is worth explaining too. */
const HELD_CLEANLY: RealWorldLesson = {
  title: 'Keeping supply and demand equal, continuously, is the whole job',
  body: 'Electricity is generated and consumed in the same instant — the grid stores essentially none of it — so supply and demand must match second by second or frequency moves. That single constraint is why every number on your console exists: frequency is the running scoreboard of that balance, reserve is the margin you hold against being wrong, and corridor loading is whether the network can physically deliver the match you achieved. You held that balance through the whole shift, which looks uneventful from outside and is exactly what a control room is for.',
};

/** Pick the lesson this run earned. */
export function selectLesson(input: LessonInput): RealWorldLesson {
  for (const entry of LESSONS) {
    if (entry.when(input)) return entry.lesson;
  }
  return HELD_CLEANLY;
}
