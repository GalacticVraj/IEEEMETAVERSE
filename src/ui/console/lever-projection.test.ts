import type { FrequencyMachine } from '@engine/frequency';
import { describe, expect, it } from 'vitest';

import { summariseLever } from './lever-projection';

const FLEET: readonly FrequencyMachine[] = [
  { id: 'G-BASE-S', kind: 'Baseload', ratedMw: 400, outputMw: 400, online: true },
  { id: 'G-PEAK-S', kind: 'Peaker', ratedMw: 220, outputMw: 200, online: true },
  { id: 'G-IMPORT', kind: 'Import', ratedMw: 200, outputMw: 200, online: true },
];

const at = (frequencyHz: number, generationMw: number, demandMw: number) => ({
  machines: FLEET,
  generationMw,
  demandMw,
  frequencyHz,
});

describe('summariseLever', () => {
  it('does NOT recommend shedding a healthy grid', () => {
    // The operator cares about distance from nominal, not raw direction.
    // Shedding 78 MW off a balanced grid drives it to ~62.3 Hz — a dangerous
    // over-frequency excursion. Reporting that as "+2.31 Hz" in green would
    // advise the exact wrong action.
    const s = summariseLever(at(60, 800, 800), 78);
    expect(s.helps).toBe(false);
    expect(s.overshoots).toBe(true);
    expect(s.projectedHz).toBeGreaterThan(61);
  });

  it('recommends shedding when the grid is genuinely short', () => {
    const s = summariseLever(at(59.5, 800, 900), 78);
    expect(s.helps).toBe(true);
    expect(s.overshoots).toBe(false);
    // Deviation from nominal must shrink.
    expect(s.deviationImprovementHz).toBeGreaterThan(0);
  });

  it('reports the improvement as movement toward 60 Hz', () => {
    const s = summariseLever(at(59.5, 800, 900), 78);
    const before = Math.abs(s.doNothingHz - 60);
    const after = Math.abs(s.projectedHz - 60);
    expect(s.deviationImprovementHz).toBeCloseTo(before - after, 6);
  });

  it('flags a lever too small to avert automatic shedding', () => {
    const s = summariseLever(at(59.4, 700, 1000), 22);
    expect(s.wouldStillShed).toBe(true);
    expect(s.avertsShedding).toBe(false);
  });

  it('credits a lever that averts automatic shedding', () => {
    const small = summariseLever(at(59.6, 800, 900), 10);
    const big = summariseLever(at(59.6, 800, 900), 120);
    expect(small.wouldStillShed || !big.wouldStillShed).toBe(true);
    if (small.wouldStillShed) expect(big.avertsShedding).toBe(true);
  });

  it('never claims an over-shedding lever helps, however large', () => {
    for (const relief of [50, 150, 400]) {
      const s = summariseLever(at(60, 800, 800), relief);
      expect(s.helps, `relief ${String(relief)}`).toBe(false);
    }
  });
});
