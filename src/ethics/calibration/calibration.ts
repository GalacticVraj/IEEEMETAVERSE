import type { MegaWatts, Ratio, ZoneId } from '@app-types';
import { createToken } from '@core';
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
  calibrateZone(zone: ZoneId, snapshot: EiaSnapshot, baseline: MegaWatts): ZoneCalibration;
  computeEquityDelta(zones: readonly ZoneCalibration[]): Ratio;
}

export const CALIBRATION_SERVICE: Token<ICalibrationService> = createToken('CalibrationService');

export class CalibrationService implements ICalibrationService {
  public calibrate(snapshot: EiaSnapshot): readonly ZoneCalibration[] {
    // In a real implementation this would map snapshot data to each zone.
    // For now we map some dummy zones.
    return [
      this.calibrateZone('zone-1' as ZoneId, snapshot, 50 as MegaWatts),
      this.calibrateZone('zone-2' as ZoneId, snapshot, 30 as MegaWatts),
    ];
  }

  public calibrateZone(zone: ZoneId, snapshot: EiaSnapshot, baseline: MegaWatts): ZoneCalibration {
    // Simple heuristic: adjust baseline by a factor based on snapshot data
    const totalRecords = snapshot.records.reduce((acc, r) => acc + r.value, 0);
    const scalingFactor = totalRecords > 0 ? 1.05 : 1.0; 
    return {
      zone,
      baselineDemand: (baseline * scalingFactor) as MegaWatts,
      confidence: 0.92 as Ratio, // Mock confidence
    };
  }

  public computeEquityDelta(zones: readonly ZoneCalibration[]): Ratio {
    if (zones.length === 0) return 0 as Ratio;
    // Difference between highest and lowest baseline demand to represent "equity gap" in energy distribution
    const max = Math.max(...zones.map(z => z.baselineDemand));
    const min = Math.min(...zones.map(z => z.baselineDemand));
    const delta = (max - min) / max;
    return (delta || 0) as Ratio;
  }
}
