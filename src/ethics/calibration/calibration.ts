import type { MegaWatts, Ratio, ZoneId } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

import type { EiaSnapshot } from '../eia/eia-snapshot';

export interface ZoneCalibration {
  readonly zone: ZoneId;
  /** Baseline demand derived from real data, used to scale the model. */
  readonly baselineDemand: MegaWatts;
  /** Confidence in the calibration, 0..1. */
  readonly confidence: Ratio;
}

/** Grounds the simulated grid in real EIA figures so numbers are defensible. */
export interface ICalibrationService {
  calibrate(snapshot: EiaSnapshot): readonly ZoneCalibration[];
}

export const CALIBRATION_SERVICE: Token<ICalibrationService> = createToken('CalibrationService');

/**
 * Placeholder calibration service.
 *
 * PHASE 6 will map bundled EIA regional demand/generation onto Meridian Bay's
 * zones so that in-sim magnitudes trace back to real published figures — the
 * basis of the "the city is real" pillar.
 */
export class PlaceholderCalibrationService implements ICalibrationService {
  public calibrate(snapshot: EiaSnapshot): readonly ZoneCalibration[] {
    return notImplemented(
      'CalibrationService.calibrate',
      'Derive per-zone baseline demand from bundled EIA data.',
      { snapshot },
    );
  }
}
