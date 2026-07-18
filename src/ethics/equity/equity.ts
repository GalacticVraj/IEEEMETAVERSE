import type { MegaWatts, Ratio, ZoneId } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

/**
 * Neutral per-zone load status. Defined here (not imported from `@engine`) so
 * that `ethics` stays UPSTREAM of the engine and no dependency cycle can form.
 * A coordinator adapts the engine's `GridState.zones` into this shape when
 * invoking the analyzer.
 */
export interface ZoneLoadStatus {
  readonly zone: ZoneId;
  readonly servedLoad: MegaWatts;
  readonly unservedLoad: MegaWatts;
}

export interface EquityDelta {
  readonly zone: ZoneId;
  /** Share of this zone's demand left unserved, 0..1. */
  readonly unservedShare: Ratio;
  /** Vulnerability-weighted equity impact, 0..1 (higher = more harm). */
  readonly equityImpact: Ratio;
}

/**
 * Evaluates the FAIRNESS of load shedding and blackouts — who bears the cost.
 * This turns a purely technical decision into an ethical one, which is the
 * point of the "Learning Through Consequence" thesis.
 */
export interface IEquityAnalyzer {
  computeEquityDelta(zones: readonly ZoneLoadStatus[]): readonly EquityDelta[];
  /** Aggregate unserved energy across the grid. */
  totalUnserved(zones: readonly ZoneLoadStatus[]): MegaWatts;
}

export const EQUITY_ANALYZER: Token<IEquityAnalyzer> = createToken('EquityAnalyzer');

/**
 * Placeholder equity analyzer.
 *
 * PHASE 6 will weight unserved load by zone vulnerability so the After-Action
 * report can show not just HOW MUCH was shed but WHO it fell on.
 */
export class PlaceholderEquityAnalyzer implements IEquityAnalyzer {
  public computeEquityDelta(zones: readonly ZoneLoadStatus[]): readonly EquityDelta[] {
    return notImplemented(
      'EquityAnalyzer.computeEquityDelta',
      'Vulnerability-weighted per-zone equity impact of shedding/blackout.',
      { zones },
    );
  }

  public totalUnserved(zones: readonly ZoneLoadStatus[]): MegaWatts {
    return notImplemented('EquityAnalyzer.totalUnserved', 'Sum unserved load across zones.', {
      zones,
    });
  }
}
