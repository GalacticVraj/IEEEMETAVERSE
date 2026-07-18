import type { Severity } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

import type { ReplayRecording } from '../model';

/** A notable moment on the replay scrubber. */
export interface TimelineMarker {
  readonly tick: number;
  readonly label: string;
  readonly severity: Severity;
}

/**
 * Derives a human-readable timeline of key beats (first overload, cascade start,
 * blackout, recovery) from a recording, for the replay scrubber and the
 * After-Action report.
 */
export interface ITimeline {
  build(recording: ReplayRecording): readonly TimelineMarker[];
}

export const TIMELINE: Token<ITimeline> = createToken('Timeline');

/**
 * Placeholder timeline builder.
 *
 * PHASE 8 will scan the recorded event stream for significant events and emit
 * ordered, severity-tagged markers.
 */
export class PlaceholderTimeline implements ITimeline {
  public build(recording: ReplayRecording): readonly TimelineMarker[] {
    return notImplemented(
      'Timeline.build',
      'Extract severity-tagged markers from the recorded event stream.',
      { recording },
    );
  }
}
