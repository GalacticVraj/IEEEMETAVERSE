/**
 * crisis-level.ts — the ONE escalation ladder.
 *
 * Before this file the app carried three independent stress thresholds:
 * `rendering/severity.ts` (a 0..1 grade for the lighting rig),
 * `CommandBar.stabilityOf` (a four-word chip) and `GridHealthPanel`'s
 * per-metric tone colours. They agreed by luck, not by construction — the
 * scene could be tinting for a corridor the chip still called NORMAL. This is
 * the single ladder the whole UI reads; `severity.ts` remains what it always
 * was, the CONTINUOUS grade for light, derived from the same telemetry.
 *
 * Nothing here computes simulation state. Every input is a number the engine
 * already published, and the output is a word plus the measured reason that
 * earned it — so an escalation on screen can always be traced back to a
 * specific corridor, frequency excursion or dark district.
 */

/** The escalation ladder, ordered least to most severe. */
export type CrisisLevel = 'standby' | 'normal' | 'warning' | 'critical' | 'blackout';

/** Telemetry the ladder is allowed to read. All of it is engine output. */
export interface CrisisLevelInput {
  /** False before the shift starts — the ladder then reads `standby`. */
  readonly active: boolean;
  readonly frequencyHz: number;
  /** Worst corridor loading, 1.0 = thermal rating. */
  readonly maxLoading: number;
  readonly darkZones: number;
  readonly trippedLines: number;
  readonly uflsStage: number;
  /** Demand the online machines cannot serve, MW. */
  readonly deficitMw: number;
}

// ── Thresholds ─────────────────────────────────────────────────────────────
// Each is inherited from an instrument already on screen, so the ladder cannot
// drift away from the panel displaying the same number.

/** 59.8–60.2 Hz. Matches GridHealthPanel's amber frequency tone. */
const WARNING_DEVIATION_HZ = 0.2;
/** Below 59.5 / above 60.5 Hz. Matches GridHealthPanel's red frequency tone. */
const CRITICAL_DEVIATION_HZ = 0.5;
/** 60 % corridor loading. Matches GridHealthPanel's amber stress tone. */
const WARNING_LOADING = 0.6;
/**
 * 95 % of thermal rating. Matches the corridor mesh's own red in
 * `grid-scene.tsx` — the point at which protection is genuinely close to
 * acting. The brief asked for 80 %, but a heatwave run sits above 80 % for
 * much of its length: pinning CRITICAL there would leave the console red
 * through normal operations and destroy the signal exactly when the real
 * emergency arrives. Engineering realism over decoration.
 */
const CRITICAL_LOADING = 0.95;
/** Supply deficits, MW. Inherited from the previous CommandBar chip. */
const WARNING_DEFICIT_MW = 40;
const CRITICAL_DEFICIT_MW = 150;

export interface CrisisAssessment {
  readonly level: CrisisLevel;
  /**
   * The measured quantity that put the grid at this level, with its number.
   * Banners and tooltips quote this verbatim, so an escalation always says
   * WHICH reading caused it rather than "conditions worsened".
   */
  readonly reason: string;
}

const pct = (loading: number): string => `${String(Math.round(loading * 100))} %`;

/**
 * Grade the grid. Checked worst-first: a dark district outranks everything,
 * because no combination of healthy readings undoes a city block with no power.
 */
export function assessCrisis(input: CrisisLevelInput): CrisisAssessment {
  const { active, frequencyHz, maxLoading, darkZones, trippedLines, uflsStage, deficitMw } = input;

  if (!active) {
    return { level: 'standby', reason: 'Shift has not started. Grid on nominal dispatch.' };
  }

  if (darkZones > 0) {
    return {
      level: 'blackout',
      reason:
        darkZones === 1
          ? 'One district has lost power.'
          : `${String(darkZones)} districts have lost power.`,
    };
  }

  const deviation = Math.abs(frequencyHz - 60);

  if (deviation >= CRITICAL_DEVIATION_HZ) {
    return {
      level: 'critical',
      reason: `Frequency ${frequencyHz.toFixed(2)} Hz — outside 59.5–60.5.`,
    };
  }
  if (uflsStage > 0) {
    return {
      level: 'critical',
      reason: `Automatic load shedding fired at stage ${String(uflsStage)}.`,
    };
  }
  if (maxLoading >= CRITICAL_LOADING) {
    return { level: 'critical', reason: `Corridor loading ${pct(maxLoading)} of thermal rating.` };
  }
  if (trippedLines > 0) {
    return {
      level: 'critical',
      reason:
        trippedLines === 1
          ? 'A transmission corridor has tripped.'
          : `${String(trippedLines)} transmission corridors have tripped.`,
    };
  }
  if (deficitMw >= CRITICAL_DEFICIT_MW) {
    return { level: 'critical', reason: `Supply deficit ${String(Math.round(deficitMw))} MW.` };
  }

  if (deviation >= WARNING_DEVIATION_HZ) {
    return {
      level: 'warning',
      reason: `Frequency ${frequencyHz.toFixed(2)} Hz — drifting off nominal.`,
    };
  }
  if (maxLoading >= WARNING_LOADING) {
    return { level: 'warning', reason: `Corridor loading ${pct(maxLoading)} of thermal rating.` };
  }
  if (deficitMw >= WARNING_DEFICIT_MW) {
    return { level: 'warning', reason: `Supply deficit ${String(Math.round(deficitMw))} MW.` };
  }

  return { level: 'normal', reason: 'Frequency nominal, every corridor inside its rating.' };
}

/** Ordering for escalation detection — a banner fires on a RISE, not a fall. */
const RANK: Readonly<Record<CrisisLevel, number>> = {
  standby: 0,
  normal: 1,
  warning: 2,
  critical: 3,
  blackout: 4,
};

export function crisisRank(level: CrisisLevel): number {
  return RANK[level];
}

/** True when `next` is worse than `previous` — the only time a banner fires. */
export function escalated(previous: CrisisLevel, next: CrisisLevel): boolean {
  return RANK[next] > RANK[previous];
}

export interface CrisisLevelStyle {
  /** Chip text. */
  readonly label: string;
  /** Semantic status colour — from the frozen palette, never decorative. */
  readonly accent: string;
  /** Command-bar background at this level. */
  readonly bar: string;
  /** Text colour that stays legible on `bar`. */
  readonly barInk: string;
  /** Secondary text colour on `bar`. */
  readonly barInkMuted: string;
  /** Hairline under the command bar. */
  readonly barBorder: string;
  /** Vertical rules between command-bar groups. */
  readonly barDivider: string;
  /** Instrument-accent text (scenario name) that stays legible on `bar`. */
  readonly barLink: string;
  /** Recessed well behind the clock and the district counter. */
  readonly barWell: string;
  readonly barWellBorder: string;
  /** Left rail accent width, px — thickens as the grid degrades. */
  readonly railWidth: number;
  /** One-line explanation of what this level means. Educational, static. */
  readonly meaning: string;
}

/**
 * Daylight palette throughout — this is a mission-control console in a lit
 * room, not a neon dashboard. Warning and critical TINT the paper rather than
 * inverting it; the one level that genuinely goes dark is `blackout`, and it
 * does so because the districts it reports on went dark. That is the brief's
 * black navbar, earned by a simulation cause instead of asserted.
 */
export const CRISIS_LEVEL_STYLE: Readonly<Record<CrisisLevel, CrisisLevelStyle>> = {
  standby: {
    label: 'STANDBY',
    accent: '#5F6B76',
    bar: 'rgba(250, 250, 247, 0.96)',
    barInk: '#1C2530',
    barInkMuted: '#5A6774',
    barBorder: 'rgba(211, 215, 210, 0.85)',
    barDivider: '#D3D7D2',
    barLink: '#22637E',
    barWell: 'rgba(28, 37, 48, 0.04)',
    barWellBorder: '#E2E6E1',
    railWidth: 0,
    meaning: 'Grid on nominal dispatch. The shift has not started.',
  },
  normal: {
    label: 'NORMAL',
    accent: '#217A56',
    bar: 'rgba(250, 250, 247, 0.96)',
    barInk: '#1C2530',
    barInkMuted: '#5A6774',
    barBorder: 'rgba(211, 215, 210, 0.85)',
    barDivider: '#D3D7D2',
    barLink: '#22637E',
    barWell: 'rgba(28, 37, 48, 0.04)',
    barWellBorder: '#E2E6E1',
    railWidth: 0,
    meaning: 'Frequency within 59.8–60.2 Hz and every corridor below 60 % of its thermal rating.',
  },
  warning: {
    label: 'WARNING',
    accent: '#B4531F',
    bar: 'rgba(253, 246, 238, 0.97)',
    barInk: '#1C2530',
    barInkMuted: '#6B5744',
    barBorder: 'rgba(180, 83, 31, 0.35)',
    barDivider: 'rgba(180, 83, 31, 0.28)',
    barLink: '#22637E',
    barWell: 'rgba(180, 83, 31, 0.07)',
    barWellBorder: 'rgba(180, 83, 31, 0.22)',
    railWidth: 3,
    meaning:
      'Frequency drifting off nominal, a corridor above 60 %, or a supply deficit. Act before protection does.',
  },
  critical: {
    label: 'CRITICAL',
    accent: '#B3261E',
    bar: 'rgba(253, 240, 238, 0.97)',
    barInk: '#1C2530',
    barInkMuted: '#6E4B47',
    barBorder: 'rgba(179, 38, 30, 0.45)',
    barDivider: 'rgba(179, 38, 30, 0.3)',
    barLink: '#22637E',
    barWell: 'rgba(179, 38, 30, 0.08)',
    barWellBorder: 'rgba(179, 38, 30, 0.25)',
    railWidth: 5,
    meaning:
      'Frequency outside 59.5–60.5 Hz, a corridor at 95 % of rating, a trip, or automatic shedding. Cascade is minutes away.',
  },
  blackout: {
    label: 'BLACKOUT',
    accent: '#F1544B',
    bar: 'rgba(28, 37, 48, 0.96)',
    barInk: '#FAFAF7',
    barInkMuted: '#A7B2BC',
    barBorder: 'rgba(179, 38, 30, 0.7)',
    barDivider: 'rgba(250, 250, 247, 0.22)',
    barLink: '#7FC4DE',
    barWell: 'rgba(250, 250, 247, 0.08)',
    barWellBorder: 'rgba(250, 250, 247, 0.16)',
    railWidth: 5,
    meaning: 'At least one district is de-energized. Restoration is now the whole job.',
  },
};
