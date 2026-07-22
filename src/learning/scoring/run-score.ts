/**
 * run-score.ts — deterministic 7-axis mission scoring. PURE function of
 * measured run data; every score carries a reason citing the numbers that
 * earned it. No randomness, no wall clock, no invented figures.
 */
import type { LearnerTwinState } from '../model';

/** Duck-typed slice of the run-stats projection (learning must not import state). */
export interface RunStatsInput {
  readonly peakDemandMw: number;
  readonly worstBalanceMw: number;
  readonly unservedEnergyMwTicks: number;
  readonly peakCorridorStress: number;
  readonly renewableShareAvg: number;
  readonly lineTrips: number;
  readonly lineRecoveries: number;
  readonly blackoutZoneTicks: number;
  readonly zonesEverDark: readonly string[];
  readonly recoveryTicks: number | null;
}

export interface DecisionOutcomeInput {
  readonly decisionId: string;
  readonly verdict: 'improved' | 'no-effect' | 'worsened' | 'pending';
}

export interface RunScoreInput {
  readonly outcome: string; // 'Held' | 'PartialBlackout' | 'SystemBlackout'
  readonly stats: RunStatsInput;
  readonly decisions: readonly DecisionOutcomeInput[];
  readonly twin: LearnerTwinState;
}

export interface CategoryScore {
  readonly id: string;
  readonly label: string;
  readonly score: number; // 0–100 integer
  readonly reason: string;
}

const clamp = (value: number, low = 0, high = 100): number =>
  Math.round(Math.min(high, Math.max(low, value)));

const OUTCOME_BASE: Record<string, number> = {
  Held: 90,
  PartialBlackout: 55,
  SystemBlackout: 30,
};

export function scoreRun(input: RunScoreInput): readonly CategoryScore[] {
  const { stats, twin, decisions, outcome } = input;
  const unservedMwS = Math.round(stats.unservedEnergyMwTicks / 10); // ticks → seconds

  // ── Operational performance ──
  const unservedPenalty = Math.min(30, stats.unservedEnergyMwTicks / 1000);
  const operational = clamp((OUTCOME_BASE[outcome] ?? 40) - unservedPenalty);

  // ── Stability ──
  const peakPct = Math.round(stats.peakCorridorStress * 100);
  const stability = clamp(100 - stats.peakCorridorStress * 40 - stats.lineTrips * 6);

  // ── Learning progress ──
  const concepts = twin.concepts;
  const evidenceTotal = concepts.reduce((sum, c) => sum + c.evidenceCount, 0);
  const weightedMastery =
    evidenceTotal > 0
      ? concepts.reduce((sum, c) => sum + (c.mastery as number) * c.evidenceCount, 0) /
        evidenceTotal
      : 0;
  const learning = evidenceTotal > 0 ? clamp(weightedMastery * 100) : 50;

  // ── Decision quality ──
  const judged = decisions.filter((d) => d.verdict !== 'pending');
  const improvedCount = judged.filter((d) => d.verdict === 'improved').length;
  const worsenedCount = judged.filter((d) => d.verdict === 'worsened').length;
  const decisionQuality =
    judged.length === 0
      ? 40
      : clamp((improvedCount / judged.length) * 100 - worsenedCount * 5);

  // ── Resilience ──
  const recoverySeconds = stats.recoveryTicks === null ? null : stats.recoveryTicks / 10;
  let resilience: number;
  let resilienceReason: string;
  if (stats.zonesEverDark.length === 0) {
    resilience = 95;
    resilienceReason = 'No district lost power at any point in the run.';
  } else if (recoverySeconds !== null) {
    resilience = clamp(85 - recoverySeconds / 2, 40, 85);
    resilienceReason = `${stats.zonesEverDark.length} district(s) went dark (${stats.zonesEverDark.join(
      ', ',
    )}) but power was restored after ${recoverySeconds.toFixed(0)} s.`;
  } else {
    resilience = 25;
    resilienceReason = `${stats.zonesEverDark.join(', ')} lost power and never fully recovered.`;
  }

  // ── Equity & critical infrastructure ──
  const hospitalDark = stats.zonesEverDark.includes('DT');
  const equityMastery = (twin.equity_awareness_score as number) * 100;
  const equity = hospitalDark ? clamp(Math.min(35, equityMastery)) : clamp(55 + equityMastery * 0.45);

  const categories: CategoryScore[] = [
    {
      id: 'operational',
      label: 'Operational Performance',
      score: operational,
      reason: `Run outcome "${outcome}" with ${unservedMwS} MW·s of unserved energy.`,
    },
    {
      id: 'stability',
      label: 'System Stability',
      score: stability,
      reason: `Peak corridor stress reached ${peakPct} % with ${stats.lineTrips} protection trip(s).`,
    },
    {
      id: 'learning',
      label: 'Learning Progress',
      score: learning,
      reason:
        evidenceTotal > 0
          ? `Evidence-weighted mastery ${Math.round(weightedMastery * 100)} % across ${
              concepts.length
            } concept(s), backed by ${evidenceTotal} measured observation(s).`
          : 'No measured evidence yet — make interventions to build mastery.',
    },
    {
      id: 'decisions',
      label: 'Decision Quality',
      score: decisionQuality,
      reason:
        judged.length === 0
          ? 'No interventions were made — the grid ran unmanaged.'
          : `${improvedCount} of ${judged.length} intervention(s) measurably improved the grid; ${worsenedCount} made it worse.`,
    },
    { id: 'resilience', label: 'Resilience', score: resilience, reason: resilienceReason },
    {
      id: 'equity',
      label: 'Equity & Critical Infrastructure',
      score: equity,
      reason: hospitalDark
        ? 'The hospital district (Downtown) lost power — protecting critical loads is the first duty.'
        : `Critical districts stayed powered; equity awareness at ${Math.round(equityMastery)} %.`,
    },
  ];

  // ── Overall (weighted blend) ──
  const WEIGHTS: Record<string, number> = {
    operational: 0.25,
    stability: 0.2,
    decisions: 0.15,
    resilience: 0.15,
    learning: 0.15,
    equity: 0.1,
  };
  const overall = clamp(
    categories.reduce((sum, c) => sum + c.score * (WEIGHTS[c.id] ?? 0), 0),
  );
  categories.push({
    id: 'overall',
    label: 'Overall Mission Rating',
    score: overall,
    reason:
      'Weighted blend: operations 25 %, stability 20 %, decisions 15 %, resilience 15 %, learning 15 %, equity 10 %.',
  });

  return categories;
}
