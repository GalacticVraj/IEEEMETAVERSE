import { describe, expect, it } from 'vitest';

import type { LearnerTwinState } from '../model';

import { scoreRun } from './run-score';
import type { RunScoreInput, RunStatsInput } from './run-score';

const stats = (overrides: Partial<RunStatsInput> = {}): RunStatsInput => ({
  peakDemandMw: 1600,
  worstBalanceMw: -900,
  unservedEnergyMwTicks: 0,
  peakCorridorStress: 0.6,
  renewableShareAvg: 0.2,
  lineTrips: 0,
  lineRecoveries: 0,
  blackoutZoneTicks: 0,
  zonesEverDark: [],
  recoveryTicks: null,
  ...overrides,
});

const twin = (overrides: Partial<LearnerTwinState> = {}): LearnerTwinState => ({
  learner_id: 't',
  attempt: 1,
  decisions_made: 2,
  correct_tradeoff_decisions: 2,
  blackouts_caused: 0,
  zones_saved: 0,
  avg_decision_time_sec: 2,
  understanding_score: 0.7 as never,
  weak_concept_tags: [],
  equity_awareness_score: 0.62 as never,
  concepts: [
    { concept: 'Demand Response', mastery: 0.74 as never, confidence: 0.4 as never, evidenceCount: 2 },
  ],
  ...overrides,
});

const input = (overrides: Partial<RunScoreInput> = {}): RunScoreInput => ({
  outcome: 'Held',
  stats: stats(),
  decisions: [
    { decisionId: 'op-ac-residential-100', verdict: 'improved' },
    { decisionId: 'op-ev-pause-140', verdict: 'no-effect' },
  ],
  twin: twin(),
  ...overrides,
});

describe('scoreRun', () => {
  it('produces all seven categories, each with a numeric reason', () => {
    const scores = scoreRun(input());
    expect(scores).toHaveLength(7);
    for (const category of scores) {
      expect(category.score).toBeGreaterThanOrEqual(0);
      expect(category.score).toBeLessThanOrEqual(100);
      expect(category.reason.length).toBeGreaterThan(10);
    }
    expect(scores.find((c) => c.id === 'stability')?.reason).toContain('60 %');
    expect(scores.find((c) => c.id === 'decisions')?.reason).toContain('1 of 2');
  });

  it('is deterministic', () => {
    expect(scoreRun(input())).toEqual(scoreRun(input()));
  });

  it('rewards a clean run and punishes an unrecovered blackout', () => {
    const clean = scoreRun(input());
    const disaster = scoreRun(
      input({
        outcome: 'SystemBlackout',
        stats: stats({
          zonesEverDark: ['RS', 'HB'],
          blackoutZoneTicks: 900,
          unservedEnergyMwTicks: 30_000,
          peakCorridorStress: 1.2,
          lineTrips: 4,
        }),
      }),
    );
    const overall = (scores: readonly { id: string; score: number }[]): number =>
      scores.find((c) => c.id === 'overall')?.score ?? 0;
    expect(overall(clean)).toBeGreaterThan(overall(disaster) + 20);
    expect(disaster.find((c) => c.id === 'resilience')?.reason).toContain('never fully recovered');
  });

  it('caps equity hard when the hospital district went dark', () => {
    const scores = scoreRun(input({ stats: stats({ zonesEverDark: ['DT'] }) }));
    expect(scores.find((c) => c.id === 'equity')!.score).toBeLessThanOrEqual(35);
  });

  it('scores unmanaged runs honestly', () => {
    const scores = scoreRun(input({ decisions: [] }));
    const decisionScore = scores.find((c) => c.id === 'decisions');
    expect(decisionScore?.score).toBe(40);
    expect(decisionScore?.reason).toContain('unmanaged');
  });
});
