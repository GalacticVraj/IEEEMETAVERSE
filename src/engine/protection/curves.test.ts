import { describe, expect, it } from 'vitest';

import { DEFAULT_RELAY_CONFIG, ProtectionCurveType } from './config';
import { getProtectionCurve } from './curves';

const config = DEFAULT_RELAY_CONFIG; // pickup 1.0, tripDelayS 2

describe('protection curves', () => {
  it('instantaneous trips with zero delay', () => {
    expect(getProtectionCurve(ProtectionCurveType.Instantaneous).tripDelayS(2, config)).toBe(0);
  });

  it('definite-time is loading-independent', () => {
    const curve = getProtectionCurve(ProtectionCurveType.DefiniteTime);
    expect(curve.tripDelayS(1.1, config)).toBe(2);
    expect(curve.tripDelayS(3, config)).toBe(2);
  });

  it('inverse-time trips faster as loading rises', () => {
    const curve = getProtectionCurve(ProtectionCurveType.InverseTime);
    const light = curve.tripDelayS(1.1, config);
    const heavy = curve.tripDelayS(2.5, config);
    expect(heavy).toBeLessThan(light);
    expect(curve.tripDelayS(2, config)).toBeCloseTo(2, 6); // ratio 2 ⇒ tripDelayS/(2-1)
  });

  it('returns the requested curve type', () => {
    expect(getProtectionCurve(ProtectionCurveType.ThermalDelay).type).toBe(
      ProtectionCurveType.ThermalDelay,
    );
  });
});
