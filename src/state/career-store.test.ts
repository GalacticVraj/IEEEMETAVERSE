import { beforeEach, describe, expect, it } from 'vitest';

import { badgesEarned, nextRank, rankOf, useCareerStore } from './career-store';
import type { RunRecord } from './career-store';

const CLEAN_RUN: RunRecord = {
  scenarioId: 'heatwave',
  score: 80,
  zonesEverDark: 0,
  worstFrequencyDeviationHz: 0.1,
  lineTrips: 0,
  renewableShareAvg: 0.1,
  totalScenarioCount: 6,
};

describe('rankOf', () => {
  it('walks the thresholds the brief specifies', () => {
    expect(rankOf(0)).toBe('Apprentice');
    expect(rankOf(199)).toBe('Apprentice');
    expect(rankOf(200)).toBe('Operator');
    expect(rankOf(499)).toBe('Operator');
    expect(rankOf(500)).toBe('Senior Operator');
    expect(rankOf(1000)).toBe('Shift Lead');
    expect(rankOf(2000)).toBe('Chief Engineer');
    expect(rankOf(999999)).toBe('Chief Engineer');
  });
});

describe('nextRank', () => {
  it('reports what is left to earn', () => {
    expect(nextRank(0)).toEqual({ rank: 'Operator', remaining: 200 });
    expect(nextRank(450)).toEqual({ rank: 'Senior Operator', remaining: 50 });
  });

  it('is null at the top of the ladder', () => {
    expect(nextRank(2500)).toBeNull();
  });
});

describe('badgesEarned', () => {
  it('always awards the first shift', () => {
    expect(badgesEarned(CLEAN_RUN, ['heatwave'])).toContain('first-shift');
  });

  it('awards blackout-prevented only when no district ever went dark', () => {
    expect(badgesEarned(CLEAN_RUN, [])).toContain('blackout-prevented');
    expect(badgesEarned({ ...CLEAN_RUN, zonesEverDark: 1 }, [])).not.toContain(
      'blackout-prevented',
    );
  });

  it('awards steady-hand on the same 0.2 Hz band the console calls nominal', () => {
    expect(badgesEarned({ ...CLEAN_RUN, worstFrequencyDeviationHz: 0.19 }, [])).toContain(
      'steady-hand',
    );
    expect(badgesEarned({ ...CLEAN_RUN, worstFrequencyDeviationHz: 0.2 }, [])).not.toContain(
      'steady-hand',
    );
  });

  it('awards cascade-contained only when a trip actually happened AND held', () => {
    // No trip is not a contained cascade — it is an uneventful shift.
    expect(badgesEarned(CLEAN_RUN, [])).not.toContain('cascade-contained');
    expect(badgesEarned({ ...CLEAN_RUN, lineTrips: 2 }, [])).toContain('cascade-contained');
    expect(badgesEarned({ ...CLEAN_RUN, lineTrips: 2, zonesEverDark: 1 }, [])).not.toContain(
      'cascade-contained',
    );
  });

  it('awards the completionist badge only once every scenario is done', () => {
    const five = ['a', 'b', 'c', 'd', 'e'];
    expect(badgesEarned(CLEAN_RUN, five)).not.toContain('every-crisis');
    expect(badgesEarned(CLEAN_RUN, [...five, 'f'])).toContain('every-crisis');
  });
});

describe('useCareerStore', () => {
  beforeEach(() => {
    useCareerStore.getState().reset();
  });

  it('accumulates score and run count across shifts', () => {
    useCareerStore.getState().recordRun(CLEAN_RUN);
    useCareerStore.getState().recordRun({ ...CLEAN_RUN, score: 60 });

    const state = useCareerStore.getState();
    expect(state.totalRuns).toBe(2);
    expect(state.totalScore).toBe(140);
  });

  it('keeps the BEST score per scenario, not the latest', () => {
    useCareerStore.getState().recordRun({ ...CLEAN_RUN, score: 91 });
    useCareerStore.getState().recordRun({ ...CLEAN_RUN, score: 40 });
    expect(useCareerStore.getState().bestScores['heatwave']).toBe(91);
  });

  it('does not duplicate a scenario in the completed list', () => {
    useCareerStore.getState().recordRun(CLEAN_RUN);
    useCareerStore.getState().recordRun(CLEAN_RUN);
    expect(useCareerStore.getState().completedScenarios).toEqual(['heatwave']);
  });

  it('never revokes a badge earned in an earlier run', () => {
    useCareerStore.getState().recordRun(CLEAN_RUN);
    expect(useCareerStore.getState().badges).toContain('blackout-prevented');
    // A later, worse run must not take it away — it still happened.
    useCareerStore.getState().recordRun({ ...CLEAN_RUN, zonesEverDark: 3 });
    expect(useCareerStore.getState().badges).toContain('blackout-prevented');
  });

  it('falls back to a default name rather than an empty one', () => {
    useCareerStore.getState().setOperatorName('   ');
    expect(useCareerStore.getState().operatorName).toBe('Operator');
  });

  it('caps a pasted name so it cannot break the navbar layout', () => {
    useCareerStore.getState().setOperatorName('x'.repeat(200));
    expect(useCareerStore.getState().operatorName.length).toBe(24);
  });
});
