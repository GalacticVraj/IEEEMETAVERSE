import { OVERLOAD_THRESHOLD_PU, TRIP_THRESHOLD_PU } from '@constants';

/** Selectable trip-delay curve. New curves plug in without engine changes. */
export const ProtectionCurveType = {
  Instantaneous: 'instantaneous',
  DefiniteTime: 'definite-time',
  InverseTime: 'inverse-time',
  ThermalDelay: 'thermal-delay',
} as const;
export type ProtectionCurveType = (typeof ProtectionCurveType)[keyof typeof ProtectionCurveType];

export type RelayRole = 'primary' | 'backup';

/**
 * Per-relay configuration. All thresholds are per-unit line loading; all delays
 * are in simulated seconds. Defaults come from the shared simulation constants.
 */
export interface RelayConfig {
  readonly warningThreshold: number;
  readonly pickupThreshold: number;
  readonly tripThreshold: number;
  readonly emergencyThreshold: number;
  /** Base definite-time trip delay (also the reference for inverse-time). */
  readonly tripDelayS: number;
  readonly instantaneousTrip: boolean;
  /** Loading at/above which an instantaneous trip fires (no timing). */
  readonly instantaneousThreshold: number;
  /** Reset (drop-out) threshold as a fraction of pickup. */
  readonly resetRatio: number;
  readonly resetDelayS: number;
  readonly curve: ProtectionCurveType;
  /** Extra delay applied to backup relays for coordination/selectivity. */
  readonly coordinationDelayS: number;
  readonly role: RelayRole;
}

/** Thermal (RC first-order) model configuration for a line. */
export interface ThermalConfig {
  readonly ambientC: number;
  /** Steady-state temperature rise above ambient at loading = 1.0. */
  readonly ratedRiseC: number;
  /** Thermal time constant (larger ⇒ more inertia). */
  readonly timeConstantS: number;
  readonly warningC: number;
  readonly maxSafeC: number;
}

/** Breaker mechanics. */
export interface BreakerConfig {
  /** Ticks a breaker takes to travel open or closed. */
  readonly operateTicks: number;
}

export const DEFAULT_RELAY_CONFIG: RelayConfig = {
  warningThreshold: 0.9,
  pickupThreshold: OVERLOAD_THRESHOLD_PU, // 1.0
  tripThreshold: TRIP_THRESHOLD_PU, // 1.25
  emergencyThreshold: 1.5,
  tripDelayS: 2,
  instantaneousTrip: true,
  instantaneousThreshold: 1.5,
  resetRatio: 0.95,
  resetDelayS: 1,
  curve: ProtectionCurveType.InverseTime,
  coordinationDelayS: 0.5,
  role: 'primary',
};

export const DEFAULT_THERMAL_CONFIG: ThermalConfig = {
  ambientC: 25,
  ratedRiseC: 50, // steady-state 75 °C at rated loading
  timeConstantS: 5,
  warningC: 75,
  maxSafeC: 90,
};

export const DEFAULT_BREAKER_CONFIG: BreakerConfig = {
  operateTicks: 1,
};
