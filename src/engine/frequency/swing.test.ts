import { describe, expect, it } from 'vitest';

import { MIN_HZ, NOMINAL_HZ, stepSwing } from './swing';

describe('stepSwing', () => {
  it('holds nominal frequency when generation matches load', () => {
    const result = stepSwing({
      frequencyHz: NOMINAL_HZ,
      mechanicalMw: 1000,
      electricalMw: 1000,
      inertiaMwS: 3760,
      timestepS: 0.1,
    });
    expect(result.frequencyHz).toBe(NOMINAL_HZ);
    expect(result.rocofHzPerS).toBe(0);
  });

  it('produces the hand-computed RoCoF for a 200 MW deficit', () => {
    // RoCoF = f0 * dP / (2 * H*S) = 60 * -200 / (2 * 3160) = -1.8987...
    const result = stepSwing({
      frequencyHz: NOMINAL_HZ,
      mechanicalMw: 800,
      electricalMw: 1000,
      inertiaMwS: 3160,
      timestepS: 0.1,
    });
    expect(result.rocofHzPerS).toBeCloseTo(-1.8987, 3);
    expect(result.frequencyHz).toBeCloseTo(NOMINAL_HZ - 0.18987, 4);
  });

  it('falls faster at lower inertia for the same deficit', () => {
    const base = { frequencyHz: NOMINAL_HZ, mechanicalMw: 800, electricalMw: 1000, timestepS: 0.1 };
    const strong = stepSwing({ ...base, inertiaMwS: 3760 });
    const weak = stepSwing({ ...base, inertiaMwS: 1500 });
    expect(Math.abs(weak.rocofHzPerS)).toBeGreaterThan(Math.abs(strong.rocofHzPerS));
  });

  it('rises when generation exceeds load', () => {
    const result = stepSwing({
      frequencyHz: NOMINAL_HZ,
      mechanicalMw: 1050,
      electricalMw: 1000,
      inertiaMwS: 3760,
      timestepS: 0.1,
    });
    expect(result.rocofHzPerS).toBeGreaterThan(0);
    expect(result.frequencyHz).toBeGreaterThan(NOMINAL_HZ);
  });

  it('applies load damping that opposes the deviation', () => {
    // Below nominal, load self-regulation reduces demand, easing the deficit.
    const undamped = stepSwing({
      frequencyHz: NOMINAL_HZ,
      mechanicalMw: 900,
      electricalMw: 1000,
      inertiaMwS: 3760,
      timestepS: 0.1,
    });
    const damped = stepSwing({
      frequencyHz: 59.0,
      mechanicalMw: 900,
      electricalMw: 1000,
      inertiaMwS: 3760,
      timestepS: 0.1,
    });
    expect(Math.abs(damped.rocofHzPerS)).toBeLessThan(Math.abs(undamped.rocofHzPerS));
  });

  it('collapses to the floor when no synchronous machine is online', () => {
    const result = stepSwing({
      frequencyHz: 59.5,
      mechanicalMw: 500,
      electricalMw: 1000,
      inertiaMwS: 0,
      timestepS: 0.1,
    });
    expect(result.frequencyHz).toBe(MIN_HZ);
  });

  it('is deterministic — identical inputs give identical output', () => {
    const input = {
      frequencyHz: 59.7,
      mechanicalMw: 940,
      electricalMw: 1081,
      inertiaMwS: 3160,
      timestepS: 0.1,
    };
    expect(stepSwing(input)).toEqual(stepSwing(input));
  });
});
