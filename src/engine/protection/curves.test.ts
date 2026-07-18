import { describe, expect, it } from 'vitest';

import { DEFAULT_RELAY_CONFIG, ProtectionCurveType } from './config';
import { PROTECTION_CURVES, getProtectionCurve } from './curves';

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

  // --- Additional coverage for thermalDelay curve --------------------------

  it('thermal-delay curve: delay decreases as loading increases', () => {
    const curve = getProtectionCurve(ProtectionCurveType.ThermalDelay);
    const lowDelay = curve.tripDelayS(0.5, config);
    const highDelay = curve.tripDelayS(2.0, config);
    // Higher loading → shorter delay (more urgent)
    expect(highDelay).toBeLessThan(lowDelay);
  });

  it('thermal-delay curve: formula is (tripDelayS * 2) / ratio', () => {
    const curve = getProtectionCurve(ProtectionCurveType.ThermalDelay);
    // ratio = loading / pickupThreshold = 2.0 / 1.0 = 2.0
    // expected = (2 * 2) / 2 = 2
    expect(curve.tripDelayS(2.0, config)).toBeCloseTo(2, 6);
  });

  it('thermal-delay curve: uses MIN_RATIO floor for near-zero loading', () => {
    // loading = 0 ⇒ ratio is floored to MIN_RATIO, so delay is finite (very large but not Infinity)
    const curve = getProtectionCurve(ProtectionCurveType.ThermalDelay);
    const delay = curve.tripDelayS(0, config);
    expect(Number.isFinite(delay)).toBe(true);
    expect(delay).toBeGreaterThan(0);
  });

  it('inverse-time returns capped delay for loading at or below pickup threshold', () => {
    const curve = getProtectionCurve(ProtectionCurveType.InverseTime);
    // ratio ≤ 1 → returns MAX_INVERSE_MULTIPLE * tripDelayS
    const delay = curve.tripDelayS(0.5, config); // loading < pickup
    expect(delay).toBe(2 * 100); // tripDelayS(2) * MAX_INVERSE_MULTIPLE(100)
  });

  it('PROTECTION_CURVES contains all four curve types', () => {
    const types = Object.values(ProtectionCurveType);
    for (const type of types) {
      expect(PROTECTION_CURVES[type]).toBeDefined();
      expect(PROTECTION_CURVES[type].type).toBe(type);
    }
  });
});
