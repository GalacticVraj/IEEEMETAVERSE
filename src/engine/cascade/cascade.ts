import type { LineId } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

import type { LineFlow } from '../model/grid';

export interface CascadeState {
  readonly active: boolean;
  readonly step: number;
  readonly trippedLines: readonly LineId[];
}

/** Propagates overload-induced trips into cascading failure sequences. */
export interface ICascadeEngine {
  /** Given post-trip flows, compute the next cascade step (re-distribution). */
  propagate(flows: readonly LineFlow[]): CascadeState;
  isActive(): boolean;
}

export const CASCADE_ENGINE: Token<ICascadeEngine> = createToken('CascadeEngine');

/**
 * Placeholder cascade engine.
 *
 * PHASE 2 will implement the core drama loop: when a line trips, power
 * re-routes, potentially overloading neighbors, which trip in turn. Emits
 * `CascadeStarted`, one `CascadeStep` per propagation, and `CascadeEnded` when
 * the system either stabilizes or fully collapses.
 */
export class PlaceholderCascadeEngine implements ICascadeEngine {
  public propagate(flows: readonly LineFlow[]): CascadeState {
    return notImplemented(
      'CascadeEngine.propagate',
      'Iterative overload → trip → re-distribution cascade with step events.',
      { flows },
    );
  }

  public isActive(): boolean {
    return notImplemented('CascadeEngine.isActive', 'Report whether a cascade is in progress.');
  }
}
