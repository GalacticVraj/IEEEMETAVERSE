import { describe, expect, it } from 'vitest';

import { crisisGrade } from './severity';
import type { SeverityInput } from './severity';

const CALM: SeverityInput = {
  frequencyHz: 60,
  maxLoading: 0.5,
  darkZones: 0,
  totalZones: 6,
  trippedLines: 0,
  uflsStage: 0,
};

describe('crisisGrade', () => {
  it('is zero on a healthy grid', () => {
    expect(crisisGrade(CALM)).toBe(0);
  });

  it('is zero before the projection has any zones — the hero screen never tints', () => {
    expect(crisisGrade({ ...CALM, totalZones: 0, frequencyHz: 55, uflsStage: 3 })).toBe(0);
  });

  it('ignores normal frequency wander', () => {
    expect(crisisGrade({ ...CALM, frequencyHz: 60.05 })).toBe(0);
  });

  it('rises with frequency deviation in either direction', () => {
    const low = crisisGrade({ ...CALM, frequencyHz: 59.3 });
    const high = crisisGrade({ ...CALM, frequencyHz: 60.7 });
    expect(low).toBeGreaterThan(0);
    expect(low).toBeCloseTo(high, 10);
    expect(crisisGrade({ ...CALM, frequencyHz: 58.5 })).toBeGreaterThan(low);
  });

  it('saturates at 1 and never exceeds it', () => {
    expect(crisisGrade({ ...CALM, frequencyHz: 55 })).toBe(1);
    expect(crisisGrade({ ...CALM, frequencyHz: 40, uflsStage: 9, trippedLines: 99 })).toBe(1);
  });

  it('ignores corridor loading below the stress floor', () => {
    expect(crisisGrade({ ...CALM, maxLoading: 0.74 })).toBe(0);
    expect(crisisGrade({ ...CALM, maxLoading: 0.9 })).toBeGreaterThan(0);
  });

  it('takes the WORST component, not the average', () => {
    // Five nominal readings and one dark district is not a calm grid.
    const oneDark = crisisGrade({ ...CALM, darkZones: 1 });
    expect(oneDark).toBeCloseTo(1 / 3, 5);
    // Averaging would have buried this near zero.
    expect(oneDark).toBeGreaterThan(0.3);
  });

  it('saturates the blackout term at half the city', () => {
    expect(crisisGrade({ ...CALM, darkZones: 3 })).toBe(1);
    expect(crisisGrade({ ...CALM, darkZones: 6 })).toBe(1);
  });

  it('escalates with each UFLS stage', () => {
    const one = crisisGrade({ ...CALM, uflsStage: 1 });
    const two = crisisGrade({ ...CALM, uflsStage: 2 });
    expect(two).toBeGreaterThan(one);
    expect(crisisGrade({ ...CALM, uflsStage: 3 })).toBe(1);
  });

  it('escalates with line trips', () => {
    expect(crisisGrade({ ...CALM, trippedLines: 1 })).toBeCloseTo(1 / 3, 5);
    expect(crisisGrade({ ...CALM, trippedLines: 3 })).toBe(1);
  });

  it('is monotonic — adding a fault never lowers the grade', () => {
    const base = crisisGrade({ ...CALM, maxLoading: 0.85 });
    expect(crisisGrade({ ...CALM, maxLoading: 0.85, trippedLines: 1 })).toBeGreaterThanOrEqual(
      base,
    );
  });
});
