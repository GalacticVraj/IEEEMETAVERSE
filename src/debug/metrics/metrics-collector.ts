import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

export interface DebugMetrics {
  readonly fps: number;
  readonly tickRate: number;
  /** Heap usage in MB where available, else null. */
  readonly memoryMB: number | null;
}

/** Samples runtime performance metrics for the developer overlay. */
export interface IMetricsCollector {
  sample(): DebugMetrics;
}

export const METRICS_COLLECTOR: Token<IMetricsCollector> = createToken('MetricsCollector');

/**
 * Placeholder metrics collector.
 *
 * A later pass will measure real frame rate (rAF deltas), effective tick rate,
 * and `performance.memory` where exposed.
 */
export class PlaceholderMetricsCollector implements IMetricsCollector {
  public sample(): DebugMetrics {
    return notImplemented(
      'MetricsCollector.sample',
      'Sample FPS from rAF deltas, tick rate, and heap usage.',
    );
  }
}
