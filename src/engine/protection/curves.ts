import { ProtectionCurveType } from './config';
import type { RelayConfig } from './config';

/**
 * A protection trip-delay curve. New curves register in {@link PROTECTION_CURVES}
 * and are selected by `RelayConfig.curve` — the relay engine never changes.
 */
export interface ProtectionCurve {
  readonly type: ProtectionCurveType;
  /** Trip delay (seconds) for a sustained `loading` (per-unit). */
  tripDelayS(loading: number, config: RelayConfig): number;
}

/** Cap so a barely-above-pickup loading yields a finite (very long) delay. */
const MAX_INVERSE_MULTIPLE = 100;
/** Floor on the loading ratio to avoid division by zero. */
const MIN_RATIO = 1e-6;

const instantaneous: ProtectionCurve = {
  type: ProtectionCurveType.Instantaneous,
  tripDelayS: () => 0,
};

const definiteTime: ProtectionCurve = {
  type: ProtectionCurveType.DefiniteTime,
  tripDelayS: (_loading, config) => config.tripDelayS,
};

const inverseTime: ProtectionCurve = {
  type: ProtectionCurveType.InverseTime,
  tripDelayS: (loading, config) => {
    const ratio = loading / config.pickupThreshold;
    if (ratio <= 1) return config.tripDelayS * MAX_INVERSE_MULTIPLE;
    return Math.min(config.tripDelayS / (ratio - 1), config.tripDelayS * MAX_INVERSE_MULTIPLE);
  },
};

const thermalDelay: ProtectionCurve = {
  type: ProtectionCurveType.ThermalDelay,
  tripDelayS: (loading, config) => {
    const ratio = Math.max(loading / config.pickupThreshold, MIN_RATIO);
    return (config.tripDelayS * 2) / ratio;
  },
};

export const PROTECTION_CURVES: Record<ProtectionCurveType, ProtectionCurve> = {
  [ProtectionCurveType.Instantaneous]: instantaneous,
  [ProtectionCurveType.DefiniteTime]: definiteTime,
  [ProtectionCurveType.InverseTime]: inverseTime,
  [ProtectionCurveType.ThermalDelay]: thermalDelay,
};

export function getProtectionCurve(type: ProtectionCurveType): ProtectionCurve {
  return PROTECTION_CURVES[type];
}
