import { asSeconds } from '@app-types';
import type { Seconds } from '@app-types';
import type { Clock } from '@core';

/**
 * Concrete fixed-timestep {@link Clock}. Holds tick count and elapsed time as
 * plain numbers internally and brands them on read. `advance()` is the only way
 * time moves — the kernel calls it exactly once per simulation tick.
 */
export function createSimClock(timestep: Seconds): Clock {
  const step = timestep as number;
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
    advance(): void {
      tickCount += 1;
      elapsed += step;
    },
    reset(): void {
      tickCount = 0;
      elapsed = 0;
    },
  };
}
