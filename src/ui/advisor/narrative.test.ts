import { describe, expect, it } from 'vitest';

import type { AdvisorContext } from './advisor-client';
import { buildDeterministicNarrative } from './narrative';

const context = (overrides: Partial<AdvisorContext> = {}): AdvisorContext => ({
  outcome: 'Held',
  scenario: 'Record Heatwave',
  stats: {
    peakDemandMw: 1610,
    worstBalanceMw: -940,
    unservedMwS: 0,
    peakCorridorStressPct: 96,
    renewableSharePct: 21,
    lineTrips: 1,
    zonesDarkened: [],
    recoverySeconds: null,
  },
  scores: [
    { label: 'System Stability', score: 58, reason: 'Peak corridor stress reached 96 % with 1 protection trip(s).' },
    { label: 'Overall Mission Rating', score: 74, reason: 'Weighted blend.' },
  ],
  moments: [
    { t: 'T+00:06', title: 'Generator lost: Southbay Baseload Plant', detail: '−400 MW capacity' },
    { t: 'T+00:41', title: 'Line GS1-DT1 tripped', detail: 'cause: Overload' },
  ],
  decisions: [
    { label: 'Reduce residential AC', t: 'T+00:52', verdict: 'improved', stressBeforePct: 96, stressAfterPct: 78 },
  ],
  mastery: [{ concept: 'Demand Response', masteryPct: 62, evidenceCount: 1 }],
  ...overrides,
});

describe('deterministic narrative', () => {
  it('cites only real timestamps and measured numbers from the evidence', () => {
    const text = buildDeterministicNarrative(context());
    expect(text).toContain('T+00:06');
    expect(text).toContain('Reduce residential AC');
    expect(text).toContain('96 %');
    expect(text).toContain('78');
    expect(text).toContain('Demand Response');
    // No other T+ stamps than the ones in evidence.
    const stamps = text.match(/T\+\d\d:\d\d/g) ?? [];
    for (const stamp of stamps) {
      expect(['T+00:06', 'T+00:41', 'T+00:52']).toContain(stamp);
    }
  });

  it('states an unmanaged run plainly instead of inventing decisions', () => {
    const text = buildDeterministicNarrative(context({ decisions: [] }));
    expect(text).toContain('no interventions');
  });

  it('is deterministic', () => {
    expect(buildDeterministicNarrative(context())).toBe(buildDeterministicNarrative(context()));
  });
});
