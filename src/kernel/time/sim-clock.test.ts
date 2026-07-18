import { asSeconds } from '@app-types';
import { describe, expect, it } from 'vitest';

import { createClockFromFrequency, createSimClock } from './sim-clock';

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

  it('reports its frequency in Hz', () => {
    const clock = createSimClock(asSeconds(0.05));
    expect(clock.frequencyHz).toBeCloseTo(20);
  });

  it('getState/setState round-trips the position', () => {
    const clock = createSimClock(asSeconds(0.1));
    clock.advance();
    clock.advance();
    clock.advance();
    const state = clock.getState();

    const restored = createSimClock(asSeconds(0.1));
    restored.setState(state);
    expect(restored.tick).toBe(3);
    expect(restored.time as number).toBeCloseTo(0.3);
  });
});

describe('createClockFromFrequency', () => {
  it('derives the timestep from a frequency', () => {
    const clock = createClockFromFrequency(10);
    expect(clock.timestep as number).toBeCloseTo(0.1);
    expect(clock.frequencyHz).toBeCloseTo(10);
    clock.advance();
    expect(clock.time as number).toBeCloseTo(0.1);
  });

  it('rejects a non-positive frequency', () => {
    expect(() => createClockFromFrequency(0)).toThrow();
    expect(() => createClockFromFrequency(-5)).toThrow();
  });
});
