import { asSeconds } from '@app-types';
import { describe, expect, it } from 'vitest';

import { createSimClock } from './sim-clock';

describe('SimClock', () => {
  it('starts at zero', () => {
    const clock = createSimClock(asSeconds(0.1));
    expect(clock.tick).toBe(0);
    expect(clock.time as number).toBe(0);
  });

  it('advances by exactly the fixed timestep', () => {
    const clock = createSimClock(asSeconds(0.25));
    clock.advance();
    clock.advance();
    expect(clock.tick).toBe(2);
    expect(clock.time as number).toBeCloseTo(0.5);
  });

  it('resets tick and time to zero', () => {
    const clock = createSimClock(asSeconds(0.1));
    clock.advance();
    clock.reset();
    expect(clock.tick).toBe(0);
    expect(clock.time as number).toBe(0);
  });
});
