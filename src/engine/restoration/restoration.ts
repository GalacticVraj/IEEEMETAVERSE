import type { LineId, ZoneId } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

import type { GridState } from '../model/grid';

export interface RestorationPlan {
  readonly linesToClose: readonly LineId[];
  readonly zonesToRestore: readonly ZoneId[];
}

/** Plans re-energization of tripped lines and blacked-out zones. */
export interface IRestorationController {
  plan(state: GridState): RestorationPlan;
}

export const RESTORATION_CONTROLLER: Token<IRestorationController> =
  createToken('RestorationController');

/**
 * Placeholder restoration controller.
 *
 * PHASE 3 will implement staged black-start / re-close logic that respects
 * cooling times (a tripped line cannot re-close while hot), prioritizes
 * critical loads, and avoids re-triggering the cascade — emitting
 * `LineRecovered` and `ZonePowered` as service returns.
 */
export class PlaceholderRestorationController implements IRestorationController {
  public plan(state: GridState): RestorationPlan {
    return notImplemented(
      'RestorationController.plan',
      'Staged re-close/black-start honoring cooling times and critical-load priority.',
      { state },
    );
  }
}
