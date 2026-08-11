import { describe, expect, it } from 'vitest';
import { DEFAULT_MUSIC_THRESHOLDS, MusicStateController, getMusicState } from './music-state';

describe('getMusicState (pure function)', () => {
  it('returns calm when stress < 40% and frequency deviation < 0.2 Hz', () => {
    expect(getMusicState(0.1, 50.0)).toBe('calm');
    expect(getMusicState(0.39, 50.1)).toBe('calm');
    expect(getMusicState(0.0, 49.9)).toBe('calm');
  });

  it('returns tense when stress is in 40%-75% range or frequency deviation is 0.2-0.5 Hz', () => {
    expect(getMusicState(0.45, 50.0)).toBe('tense');
    expect(getMusicState(0.74, 50.15)).toBe('tense');
    expect(getMusicState(0.2, 50.3)).toBe('tense'); // stress calm, but freq dev 0.3 Hz
  });

  it('returns critical when stress > 75% or frequency deviation > 0.5 Hz', () => {
    expect(getMusicState(0.76, 50.0)).toBe('critical');
    expect(getMusicState(0.9, 50.1)).toBe('critical');
    expect(getMusicState(0.3, 50.6)).toBe('critical'); // stress low, but freq 50.6 Hz
    expect(getMusicState(0.2, 49.3)).toBe('critical'); // freq 49.3 Hz (dev 0.7 Hz)
  });
});

describe('MusicStateController (hysteresis state machine)', () => {
  it('holds initial state until target state is sustained past hysteresis threshold', () => {
    const controller = new MusicStateController('calm', {
      ...DEFAULT_MUSIC_THRESHOLDS,
      hysteresisHoldMs: 1000,
    });

    let now = 0;
    // Step 1: Stress jumps to critical
    let result = controller.update(0.85, 50.0, now);
    expect(result).toBeNull(); // candidate registered, not committed
    expect(controller.getCurrentState()).toBe('calm');

    // Step 2: 500ms later, still critical
    now += 500;
    result = controller.update(0.85, 50.0, now);
    expect(result).toBeNull();
    expect(controller.getCurrentState()).toBe('calm');

    // Step 3: 1050ms later, sustained critical past hold threshold
    now += 550;
    result = controller.update(0.85, 50.0, now);
    expect(result).toBe('critical');
    expect(controller.getCurrentState()).toBe('critical');
  });

  it('resets candidate if stress flaps back before hold window elapses', () => {
    const controller = new MusicStateController('calm', {
      ...DEFAULT_MUSIC_THRESHOLDS,
      hysteresisHoldMs: 1000,
    });

    let now = 0;
    // Stress spikes to tense for 400ms then returns to calm
    controller.update(0.5, 50.0, now);
    now += 400;
    controller.update(0.1, 50.0, now); // back to calm

    // Now spike to tense again at 800ms
    now += 400;
    let result = controller.update(0.5, 50.0, now);
    expect(result).toBeNull();

    // 500ms after second spike (total 1300ms, but candidate reset at 800ms)
    now += 500;
    result = controller.update(0.5, 50.0, now);
    expect(result).toBeNull(); // hold window from 800ms has not passed 1000ms

    // 1050ms after second spike
    now += 550;
    result = controller.update(0.5, 50.0, now);
    expect(result).toBe('tense');
  });
});
