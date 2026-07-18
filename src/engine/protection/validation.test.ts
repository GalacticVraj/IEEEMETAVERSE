import { describe, expect, it } from 'vitest';

import { DEFAULT_BREAKER_CONFIG, DEFAULT_RELAY_CONFIG, DEFAULT_THERMAL_CONFIG } from './config';
import { validateProtectionConfig } from './validation';

const check = (
  relay = DEFAULT_RELAY_CONFIG,
  thermal = DEFAULT_THERMAL_CONFIG,
  breaker = DEFAULT_BREAKER_CONFIG,
) => validateProtectionConfig(relay, thermal, breaker);

describe('validateProtectionConfig', () => {
  it('accepts the defaults', () => {
    expect(check().valid).toBe(true);
  });

  it('rejects out-of-order thresholds', () => {
    const report = check({ ...DEFAULT_RELAY_CONFIG, pickupThreshold: 2, tripThreshold: 1 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'INVALID_THRESHOLD')).toBe(true);
  });

  it('rejects negative timing', () => {
    const report = check({ ...DEFAULT_RELAY_CONFIG, tripDelayS: -1 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'IMPOSSIBLE_TIMING')).toBe(true);
  });

  it('rejects a thermal warning at/above the safe limit', () => {
    const report = check(DEFAULT_RELAY_CONFIG, { ...DEFAULT_THERMAL_CONFIG, warningC: 95 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'INVALID_THRESHOLD')).toBe(true);
  });

  it('rejects a non-positive thermal time constant', () => {
    const report = check(DEFAULT_RELAY_CONFIG, { ...DEFAULT_THERMAL_CONFIG, timeConstantS: 0 });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === 'IMPOSSIBLE_TIMING')).toBe(true);
  });
});
