import { asSeconds } from '@app-types';
import type { Seconds } from '@app-types';
import { GridGuardError } from '@core';
import type { Clock, ClockState } from '@core';

/**
 * Concrete fixed-timestep {@link Clock}. Holds tick count and elapsed time as
 * plain numbers internally and brands them on read. `advance()` is the only way
 * time moves — the kernel calls it exactly once per simulation tick.
 */
export function createSimClock(timestep: Seconds): Clock {
  const step = timestep as number;
  if (step <= 0) {
    throw new GridGuardError(`SimClock timestep must be positive, got ${step}`);
  }
  const frequencyHz = 1 / step;
  let tickCount = 0;
  let elapsed = 0;

  return {
    get tick(): number {
      return tickCount;
    },
    get time(): Seconds {
      return asSeconds(elapsed);
    },
    timestep,
    frequencyHz,
    advance(): void {
      tickCount += 1;
      elapsed += step;
    },
    reset(): void {
      tickCount = 0;
      elapsed = 0;
    },
    getState(): ClockState {
      return { tick: tickCount, elapsed };
    },
    setState(state: ClockState): void {
      tickCount = state.tick;
      elapsed = state.elapsed;
    },
  };
}

/** Build a clock from a simulation frequency (e.g. 5, 10, 20, 30, 60 Hz). */
export function createClockFromFrequency(frequencyHz: number): Clock {
  if (frequencyHz <= 0) {
    throw new GridGuardError(`Simulation frequency must be positive, got ${frequencyHz}`);
  }
  return createSimClock(asSeconds(1 / frequencyHz));
}
