import { describe, expect, it } from 'vitest';

import { DAY, DUSK, NIGHT, nightFactor, paletteAt, sunPosition, windowGlow } from './time-of-day';

describe('time-of-day arc', () => {
  it('holds full daylight through the orientation phase', () => {
    expect(nightFactor(0)).toBe(0);
    expect(nightFactor(500)).toBeLessThan(0.02);
  });

  it('reaches full night by shift end, monotonically', () => {
    let previous = -1;
    for (let tick = 0; tick <= 1800; tick += 100) {
      const f = nightFactor(tick);
      expect(f).toBeGreaterThanOrEqual(previous);
      previous = f;
    }
    expect(nightFactor(1800)).toBe(1);
  });

  it('lerps day→dusk→night without discontinuities at the dusk point', () => {
    const before = paletteAt(0.549);
    const after = paletteAt(0.551);
    expect(before.to).toBe(DUSK);
    expect(after.from).toBe(DUSK);
    expect(before.t).toBeCloseTo(1, 1);
    expect(after.t).toBeCloseTo(0, 1);
    expect(paletteAt(0).from).toBe(DAY);
    expect(paletteAt(1).to).toBe(NIGHT);
  });

  it('sun sets toward the western horizon and windows glow at night', () => {
    const [, noonY] = sunPosition(0);
    const [, nightY] = sunPosition(1);
    expect(nightY).toBeLessThan(noonY);
    expect(windowGlow(0)).toBe(1);
    expect(windowGlow(1)).toBeGreaterThan(5);
  });
});
