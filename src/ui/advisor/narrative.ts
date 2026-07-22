/**
 * narrative.ts — evidence assembly + deterministic narrative generation.
 *
 * `buildAdvisorContext` gathers ONE structured evidence bundle from the real
 * run (stats, event log, measured decision records, twin). The deterministic
 * narrative renders that bundle locally; Gemini, when reachable, rewrites the
 * SAME bundle — so both paths reach the same educational conclusions.
 */
import type { DecisionEvidence } from '@learning';
import type { CategoryScore } from '@learning';
import type { LearnerTwinState } from '@learning';
import type { EventLogEntry, RunStats } from '@state';
import { labelForDecision, recoveryTicksOf } from '@state';

import type {
  AdvisorContext,
  AdvisorDecisionContext,
  AdvisorMasteryContext,
  AdvisorMomentContext,
} from './advisor-client';

const clock = (tick: number): string => {
  const totalSeconds = Math.floor(tick / 10);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `T+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/** The most instructive log entries: severity-first, then chronological. */
function topMoments(entries: readonly EventLogEntry[], limit: number): AdvisorMomentContext[] {
  const rank: Record<string, number> = { critical: 3, warning: 2, recovery: 2, caution: 1, info: 0 };
  return [...entries]
    .sort((a, b) => (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0) || a.tick - b.tick)
    .slice(0, limit)
    .sort((a, b) => a.tick - b.tick)
    .map((entry) => ({ t: clock(entry.tick), title: entry.title, detail: entry.detail }));
}

export function buildAdvisorContext(input: {
  readonly outcome: string;
  readonly scenario: string;
  readonly stats: RunStats;
  readonly entries: readonly EventLogEntry[];
  readonly decisions: readonly DecisionEvidence[];
  readonly twin: LearnerTwinState;
  readonly scores: readonly CategoryScore[];
}): AdvisorContext {
  const { stats } = input;
  const recoveryTicks = recoveryTicksOf(stats);

  const decisions: AdvisorDecisionContext[] = input.decisions.map((record) => ({
    label: labelForDecision(record.decisionId),
    t: clock(record.tick),
    verdict: record.verdict,
    stressBeforePct: Math.round(record.pre.maxLoading * 100),
    stressAfterPct: record.post === null ? null : Math.round(record.post.maxLoading * 100),
  }));

  const mastery: AdvisorMasteryContext[] = input.twin.concepts.map((concept) => ({
    concept: concept.concept,
    masteryPct: Math.round((concept.mastery as number) * 100),
    evidenceCount: concept.evidenceCount,
  }));

  return {
    outcome: input.outcome,
    scenario: input.scenario,
    stats: {
      peakDemandMw: Math.round(stats.peakDemandMw),
      worstBalanceMw: Math.round(stats.worstBalanceMw),
      unservedMwS: Math.round(stats.unservedEnergyMwTicks / 10),
      peakCorridorStressPct: Math.round(stats.peakCorridorStress * 100),
      renewableSharePct: Math.round(stats.renewableShareAvg * 100),
      lineTrips: stats.lineTrips,
      zonesDarkened: stats.zonesEverDark,
      recoverySeconds: recoveryTicks === null ? null : Math.round(recoveryTicks / 10),
    },
    scores: input.scores.map((score) => ({
      label: score.label,
      score: score.score,
      reason: score.reason,
    })),
    moments: topMoments(input.entries, 6),
    decisions,
    mastery,
  };
}

/**
 * The always-available narrative — plain sentences assembled from the same
 * evidence bundle Gemini receives. Never invents anything.
 */
export function buildDeterministicNarrative(context: AdvisorContext): string {
  const parts: string[] = [];

  // 1. What happened.
  const held = context.outcome === 'Held';
  const opening = held
    ? `You held Meridian Bay through the ${context.scenario}.`
    : `The ${context.scenario} ended in a ${context.outcome === 'SystemBlackout' ? 'system blackout' : 'partial blackout'}.`;
  const momentText =
    context.moments.length > 0
      ? ` Key moments: ${context.moments
          .slice(0, 3)
          .map((moment) => `${moment.t} — ${moment.title.toLowerCase()}`)
          .join('; ')}.`
      : ' No major disturbances were logged.';
  parts.push(opening + momentText);

  // 2. The intervention that mattered most (measured).
  const improved = context.decisions.filter((d) => d.verdict === 'improved');
  const worsened = context.decisions.filter((d) => d.verdict === 'worsened');
  if (improved.length > 0) {
    const best = improved[0]!;
    parts.push(
      `Your most effective intervention was “${best.label}” at ${best.t} — corridor stress fell from ${best.stressBeforePct} % to ${best.stressAfterPct ?? '—'} % in the evaluation window.`,
    );
  } else if (context.decisions.length > 0) {
    parts.push(
      `None of your ${context.decisions.length} intervention(s) produced a measurable improvement within its evaluation window — timing and targeting are the next skill to build.`,
    );
  } else {
    parts.push('You made no interventions this run — the grid ran unmanaged.');
  }

  // 3. One grounded improvement.
  if (worsened.length > 0) {
    const worst = worsened[0]!;
    parts.push(
      `To improve: “${worst.label}” at ${worst.t} preceded a stress rise (${worst.stressBeforePct} % → ${worst.stressAfterPct ?? '—'} %) — check which corridors that load actually feeds before shedding.`,
    );
  } else {
    const lowest = [...context.scores]
      .filter((score) => score.label !== 'Overall Mission Rating')
      .sort((a, b) => a.score - b.score)[0];
    if (lowest !== undefined) {
      parts.push(`Biggest improvement area: ${lowest.label} (${lowest.score}/100) — ${lowest.reason}`);
    }
  }

  // 4. Encouraging close from mastery data.
  const strongest = [...context.mastery].sort((a, b) => b.masteryPct - a.masteryPct)[0];
  if (strongest !== undefined && strongest.evidenceCount > 0) {
    parts.push(
      `Your strongest concept is ${strongest.concept} at ${strongest.masteryPct} % mastery, backed by ${strongest.evidenceCount} measured observation(s) — build on it next run.`,
    );
  } else {
    parts.push('Run the scenario again and intervene early — every decision becomes measured evidence of what you understand.');
  }

  return parts.join(' ');
}
