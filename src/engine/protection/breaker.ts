import type { LineId } from '@app-types';

import type { BreakerConfig } from './config';

/** Explicit breaker mechanical states. */
export const BreakerPhase = {
  Closed: 'Closed',
  Opening: 'Opening',
  Open: 'Open',
  Closing: 'Closing',
  Locked: 'Locked',
  Maintenance: 'Maintenance',
  Faulted: 'Faulted',
} as const;
export type BreakerPhase = (typeof BreakerPhase)[keyof typeof BreakerPhase];

/** Command from the protection engine. The breaker never decides on its own. */
export type BreakerCommand = 'open' | 'close' | 'lock' | 'none';

export interface ProtectionBreaker {
  readonly id: string;
  readonly line: LineId;
  readonly phase: BreakerPhase;
  readonly config: BreakerConfig;
  readonly transitionStartedTick: number | null;
  readonly operationCount: number;
}

export interface BreakerEvent {
  readonly name: string;
  readonly payload: unknown;
}

export interface BreakerStepResult {
  readonly breaker: ProtectionBreaker;
  readonly events: readonly BreakerEvent[];
  /** True on the tick the breaker becomes fully Open (engine removes the line). */
  readonly reachedOpen: boolean;
  /** True on the tick the breaker becomes fully Closed. */
  readonly reachedClosed: boolean;
}

export function createProtectionBreaker(
  id: string,
  line: LineId,
  config: BreakerConfig,
  phase: BreakerPhase = BreakerPhase.Closed,
): ProtectionBreaker {
  return { id, line, phase, config, transitionStartedTick: null, operationCount: 0 };
}

const event = (name: string, breaker: ProtectionBreaker, tick: number): BreakerEvent => ({
  name,
  payload: { breaker: breaker.id, line: breaker.line, tick },
});

const settled = (
  breaker: ProtectionBreaker,
  events: readonly BreakerEvent[] = [],
): BreakerStepResult => ({
  breaker,
  events,
  reachedOpen: false,
  reachedClosed: false,
});

/**
 * Advance a breaker one tick, executing the relay's command. Pure and
 * deterministic. Breakers never calculate electrical conditions — they only
 * travel between states over the configured operate time. The `reachedOpen`
 * flag tells the engine to request the (transaction-based) topology change.
 */
export function stepBreaker(
  breaker: ProtectionBreaker,
  command: BreakerCommand,
  tick: number,
): BreakerStepResult {
  if (
    breaker.phase === BreakerPhase.Locked ||
    breaker.phase === BreakerPhase.Maintenance ||
    breaker.phase === BreakerPhase.Faulted
  ) {
    return settled(breaker);
  }

  if (command === 'lock') {
    return settled({ ...breaker, phase: BreakerPhase.Locked }, [
      event('BreakerLocked', breaker, tick),
    ]);
  }

  const elapsed = breaker.transitionStartedTick === null ? 0 : tick - breaker.transitionStartedTick;

  switch (breaker.phase) {
    case BreakerPhase.Closed: {
      if (command === 'open') {
        return settled({ ...breaker, phase: BreakerPhase.Opening, transitionStartedTick: tick }, [
          event('BreakerOpening', breaker, tick),
        ]);
      }
      return settled(breaker);
    }
    case BreakerPhase.Opening: {
      if (elapsed >= breaker.config.operateTicks) {
        const opened = {
          ...breaker,
          phase: BreakerPhase.Open,
          transitionStartedTick: null,
          operationCount: breaker.operationCount + 1,
        };
        return {
          breaker: opened,
          events: [event('BreakerOpened', opened, tick)],
          reachedOpen: true,
          reachedClosed: false,
        };
      }
      return settled(breaker, [event('BreakerOpening', breaker, tick)]);
    }
    case BreakerPhase.Open: {
      if (command === 'close') {
        return settled({ ...breaker, phase: BreakerPhase.Closing, transitionStartedTick: tick }, [
          event('BreakerClosing', breaker, tick),
        ]);
      }
      return settled(breaker);
    }
    case BreakerPhase.Closing: {
      if (elapsed >= breaker.config.operateTicks) {
        const closed = { ...breaker, phase: BreakerPhase.Closed, transitionStartedTick: null };
        return {
          breaker: closed,
          events: [event('BreakerClosed', closed, tick)],
          reachedOpen: false,
          reachedClosed: true,
        };
      }
      return settled(breaker, [event('BreakerClosing', breaker, tick)]);
    }
    default:
      return settled(breaker);
  }
}
