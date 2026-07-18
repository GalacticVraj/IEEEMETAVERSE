import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

import type { DecisionRecord } from '../model';

/** A summary of a completed run, suitable for the After-Action report. */
export interface RunAnalytics {
  readonly decisions: readonly DecisionRecord[];
  readonly optimalRate: number;
  readonly averageResponseSeconds: number;
}

/**
 * Aggregates per-run analytics from observed decisions. Feeds the evidence
 * charts (before/after mastery, optimal-rate) that make mastery visible.
 */
export interface IAnalyticsCollector {
  record(decision: DecisionRecord): void;
  summary(): RunAnalytics;
  reset(): void;
}

export const ANALYTICS_COLLECTOR: Token<IAnalyticsCollector> = createToken('AnalyticsCollector');

/**
 * Placeholder analytics collector.
 *
 * PHASE 8 will accumulate decisions across a run and compute the summary
 * statistics the After-Action report visualizes.
 */
export class PlaceholderAnalyticsCollector implements IAnalyticsCollector {
  public record(decision: DecisionRecord): void {
    notImplemented('AnalyticsCollector.record', 'Accumulate a decision into run analytics.', {
      decision,
    });
  }

  public summary(): RunAnalytics {
    return notImplemented('AnalyticsCollector.summary', 'Compute run summary statistics.');
  }

  public reset(): void {
    notImplemented('AnalyticsCollector.reset', 'Clear accumulated analytics for a new run.');
  }
}
