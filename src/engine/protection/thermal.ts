import type { LineId } from '@app-types';

import type { ThermalConfig } from './config';

export type ThermalLevel = 'normal' | 'warning' | 'critical';

/** Immutable thermal state of a line. Evolves continuously across ticks. */
export interface ThermalState {
  readonly line: LineId;
  readonly temperatureC: number;
  readonly config: ThermalConfig;
}

export interface ThermalStepResult {
  readonly thermal: ThermalState;
  readonly level: ThermalLevel;
  /** True on the tick temperature first exceeds the warning limit. */
  readonly crossedWarning: boolean;
  /** True on the tick temperature first exceeds the max-safe limit. */
  readonly crossedCritical: boolean;
}

export function createThermalState(
  line: LineId,
  config: ThermalConfig,
  initialTemperatureC: number = config.ambientC,
): ThermalState {
  return { line, temperatureC: initialTemperatureC, config };
}

/** Steady-state temperature for a sustained loading: ambient + ratedRise·L². */
export function steadyStateTempC(config: ThermalConfig, loading: number): number {
  return config.ambientC + config.ratedRiseC * loading * loading;
}

const levelFor = (config: ThermalConfig, temperatureC: number): ThermalLevel => {
  if (temperatureC > config.maxSafeC) return 'critical';
  if (temperatureC > config.warningC) return 'warning';
  return 'normal';
};

/**
 * Advance the thermal state one tick using a first-order RC model:
 * temperature relaxes exponentially toward the loading's steady state with the
 * configured time constant. Temperature therefore never jumps — thermal inertia
 * is intrinsic to the model.
 */
export function stepThermal(
  thermal: ThermalState,
  loading: number,
  timestepS: number,
): ThermalStepResult {
  const { config } = thermal;
  const target = steadyStateTempC(config, loading);
  const alpha = 1 - Math.exp(-timestepS / config.timeConstantS);
  const nextTemp = thermal.temperatureC + alpha * (target - thermal.temperatureC);

  const before = thermal.temperatureC;
  return {
    thermal: { line: thermal.line, temperatureC: nextTemp, config },
    level: levelFor(config, nextTemp),
    crossedWarning: before <= config.warningC && nextTemp > config.warningC,
    crossedCritical: before <= config.maxSafeC && nextTemp > config.maxSafeC,
  };
}
