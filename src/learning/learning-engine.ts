import { createToken, notImplemented } from '@core';
import type { GridEventBus, Token } from '@core';

import type { LearnerTwinState } from './model';

/**
 * System B facade. Composes the twin, tracer, concept graph, reference policy,
 * scorer, and analytics. It subscribes to `DecisionCommitted` on the bus,
 * scores each decision, updates the twin, and emits `LearningUpdated`. It reads
 * simulation events only — it never reaches into the engine.
 */
export interface ILearningEngine {
  /** Current twin state (for HUD projection). */
  twin(): LearnerTwinState;
  /** Subscribe to the simulation event bus. */
  attach(bus: GridEventBus): void;
  /** Unsubscribe from the bus. */
  detach(): void;
}

export const LEARNING_ENGINE: Token<ILearningEngine> = createToken('LearningEngine');

/**
 * Placeholder learning engine.
 *
 * PHASE 4 will wire the subsystems together and drive the twin from committed
 * decisions, emitting `LearningUpdated` for the UI.
 */
export class PlaceholderLearningEngine implements ILearningEngine {
  public twin(): LearnerTwinState {
    return notImplemented('LearningEngine.twin', 'Return the current learner twin state.');
  }

  public attach(bus: GridEventBus): void {
    notImplemented(
      'LearningEngine.attach',
      'Subscribe to DecisionCommitted; score and update the twin.',
      { bus },
    );
  }

  public detach(): void {
    notImplemented('LearningEngine.detach', 'Unsubscribe all learning listeners.');
  }
}
