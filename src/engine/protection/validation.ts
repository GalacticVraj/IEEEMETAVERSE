import type { BreakerConfig, RelayConfig, ThermalConfig } from './config';
import type { ProtectionEngine } from './protection-engine';

export type ProtectionIssueSeverity = 'error' | 'warning';

export interface ProtectionValidationIssue {
  readonly code: string;
  readonly severity: ProtectionIssueSeverity;
  readonly message: string;
  readonly ref?: string;
}

export interface ProtectionValidationReport {
  readonly valid: boolean;
  readonly issues: readonly ProtectionValidationIssue[];
}

const ABSOLUTE_ZERO_C = -273.15;
const THERMAL_OVERFLOW_C = 10000;

const report = (issues: ProtectionValidationIssue[]): ProtectionValidationReport => ({
  valid: issues.every((issue) => issue.severity !== 'error'),
  issues,
});

/**
 * Validate protection configuration. Never repairs — reports every problem so a
 * misconfigured relay/thermal/breaker is caught before it runs.
 */
export function validateProtectionConfig(
  relay: RelayConfig,
  thermal: ThermalConfig,
  breaker: BreakerConfig,
): ProtectionValidationReport {
  const issues: ProtectionValidationIssue[] = [];
  const error = (code: string, message: string): void => {
    issues.push({ code, severity: 'error', message });
  };

  // Threshold ordering: warning ≤ pickup ≤ trip ≤ emergency.
  if (!(
    relay.warningThreshold <= relay.pickupThreshold &&
    relay.pickupThreshold <= relay.tripThreshold &&
    relay.tripThreshold <= relay.emergencyThreshold
  )) {
    error(
      'INVALID_THRESHOLD',
      'Relay thresholds must be ordered warning ≤ pickup ≤ trip ≤ emergency',
    );
  }
  if (relay.instantaneousThreshold < relay.pickupThreshold) {
    error('INVALID_THRESHOLD', 'Instantaneous threshold must be ≥ pickup');
  }
  if (relay.resetRatio <= 0 || relay.resetRatio > 1) {
    error('INVALID_CONFIG', 'Reset ratio must be in (0, 1]');
  }
  if (relay.tripDelayS < 0 || relay.resetDelayS < 0 || relay.coordinationDelayS < 0) {
    error('IMPOSSIBLE_TIMING', 'Relay delays must be non-negative');
  }

  if (thermal.timeConstantS <= 0) {
    error('IMPOSSIBLE_TIMING', 'Thermal time constant must be positive');
  }
  if (thermal.ratedRiseC < 0) {
    error('INVALID_CONFIG', 'Rated temperature rise must be non-negative');
  }
  if (!(thermal.warningC < thermal.maxSafeC)) {
    error('INVALID_THRESHOLD', 'Thermal warning must be below the max-safe limit');
  }
  if (thermal.maxSafeC <= thermal.ambientC) {
    error('INVALID_THRESHOLD', 'Max-safe temperature must be above ambient');
  }
  if (thermal.ambientC < ABSOLUTE_ZERO_C) {
    error('NEGATIVE_TEMPERATURE', 'Ambient temperature is below absolute zero');
  }

  if (breaker.operateTicks < 0) {
    error('IMPOSSIBLE_TIMING', 'Breaker operate time must be non-negative');
  }

  return report(issues);
}

/**
 * Validate live protection state: every relay has a breaker, no broken line
 * references, and thermal values are physically sane.
 */
export function validateProtectionState(engine: ProtectionEngine): ProtectionValidationReport {
  const issues: ProtectionValidationIssue[] = [];

  for (const relay of engine.relays()) {
    if (engine.breakerFor(relay.line) === undefined) {
      issues.push({
        code: 'MISSING_BREAKER',
        severity: 'error',
        message: `Relay ${relay.id} has no breaker`,
        ref: relay.id,
      });
    }
  }

  for (const thermal of engine.thermals()) {
    if (Number.isNaN(thermal.temperatureC)) {
      issues.push({
        code: 'INVALID_CONFIG',
        severity: 'error',
        message: `Line ${String(thermal.line)} temperature is NaN`,
        ref: String(thermal.line),
      });
    } else if (thermal.temperatureC < ABSOLUTE_ZERO_C) {
      issues.push({
        code: 'NEGATIVE_TEMPERATURE',
        severity: 'error',
        message: `Line ${String(thermal.line)} temperature below absolute zero`,
        ref: String(thermal.line),
      });
    } else if (thermal.temperatureC > THERMAL_OVERFLOW_C) {
      issues.push({
        code: 'THERMAL_OVERFLOW',
        severity: 'error',
        message: `Line ${String(thermal.line)} temperature overflow`,
        ref: String(thermal.line),
      });
    }
  }

  return report(issues);
}
