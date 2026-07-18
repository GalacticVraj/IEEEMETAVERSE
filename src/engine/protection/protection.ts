import type { LineId, Seconds } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

import type { LineFlow } from '../model/grid';

export interface ProtectionAction {
  readonly line: LineId;
  /** True if protection should open the line. */
  readonly trip: boolean;
  /** Inverse-time delay before the trip fires. */
  readonly delay: Seconds;
}

/** Models protective relaying: which overloaded lines trip, and when. */
export interface IProtectionSystem {
  evaluate(flows: readonly LineFlow[]): readonly ProtectionAction[];
}

export const PROTECTION_SYSTEM: Token<IProtectionSystem> = createToken('ProtectionSystem');

/**
 * Placeholder protection system.
 *
 * PHASE 2 will implement inverse-time overcurrent behavior: the more a line is
 * overloaded, the sooner it trips. Emits `LineTripStarted` when a timer arms
 * and `LineTripped` when it fires, feeding the cascade engine.
 */
export class PlaceholderProtectionSystem implements IProtectionSystem {
  public evaluate(flows: readonly LineFlow[]): readonly ProtectionAction[] {
    return notImplemented(
      'ProtectionSystem.evaluate',
      'Inverse-time overcurrent tripping with armed-timer events.',
      { flows },
    );
  }
}
