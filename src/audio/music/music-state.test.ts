import { NOMINAL_FREQUENCY } from '@constants';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MUSIC_THRESHOLDS, MusicStateController, getMusicState } from './music-state';

/**
 * The grid is a 60 Hz interconnection (see NOMINAL_FREQUENCY). Deviation must be
 * measured against that nominal — an earlier revision measured against 50 Hz,
 * which made a perfectly healthy grid read as 10 Hz off nominal and pinned the
 * soundtrack to `critical` for the whole run.
 */
const NOMINAL = NOMINAL_FREQUENCY as number;

describe('getMusicState (pure function)', () => {
  it('treats the nominal grid frequency as zero deviation', () => {
    expect(NOMINAL).toBe(60);
    expect(getMusicState(0.1, NOMINAL)).toBe('calm');
  });

  it('returns calm when stress < 40% and frequency deviation < 0.2 Hz', () => {
    expect(getMusicState(0.1, 60.0)).toBe('calm');
    expect(getMusicState(0.39, 60.1)).toBe('calm');
    expect(getMusicState(0.0, 59.9)).toBe('calm');
  });

  it('returns tense when stress is in 40%-75% range or frequency deviation is 0.2-0.5 Hz', () => {
    expect(getMusicState(0.45, 60.0)).toBe('tense');
    expect(getMusicState(0.74, 60.15)).toBe('tense');
    expect(getMusicState(0.2, 60.3)).toBe('tense'); // stress calm, but freq dev 0.3 Hz
  });

  it('returns critical when stress > 75% or frequency deviation > 0.5 Hz', () => {
    expect(getMusicState(0.76, 60.0)).toBe('critical');
    expect(getMusicState(0.9, 60.1)).toBe('critical');
    expect(getMusicState(0.3, 60.6)).toBe('critical'); // stress low, but freq 60.6 Hz
    expect(getMusicState(0.2, 59.3)).toBe('critical'); // freq 59.3 Hz (dev 0.7 Hz)
  });

  it('does not treat 50 Hz as healthy on this 60 Hz grid', () => {
    // 50 Hz on a 60 Hz interconnection is a 10 Hz excursion — catastrophic.
    expect(getMusicState(0.0, 50.0)).toBe('critical');
  });
});

describe('MusicStateController (hysteresis state machine)', () => {
  it('stays calm on a healthy 60 Hz grid no matter how long it runs', () => {
    const controller = new MusicStateController('calm');
    let now = 0;
    for (let i = 0; i < 50; i++) {
      now += 100;
      expect(controller.update(0.15, 60.0, now)).toBeNull();
    }
    expect(controller.getCurrentState()).toBe('calm');
  });

  it('holds initial state until target state is sustained past hysteresis threshold', () => {
    const controller = new MusicStateController('calm', {
      ...DEFAULT_MUSIC_THRESHOLDS,
      hysteresisHoldMs: 1000,
    });

    let now = 0;
    // Step 1: Stress jumps to critical
    let result = controller.update(0.85, 60.0, now);
    expect(result).toBeNull(); // candidate registered, not committed
    expect(controller.getCurrentState()).toBe('calm');

    // Step 2: 500ms later, still critical
    now += 500;
    result = controller.update(0.85, 60.0, now);
    expect(result).toBeNull();
    expect(controller.getCurrentState()).toBe('calm');

    // Step 3: 1050ms later, sustained critical past hold threshold
    now += 550;
    result = controller.update(0.85, 60.0, now);
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
    controller.update(0.5, 60.0, now);
    now += 400;
    controller.update(0.1, 60.0, now); // back to calm

    // Now spike to tense again at 800ms
    now += 400;
    let result = controller.update(0.5, 60.0, now);
    expect(result).toBeNull();

    // 500ms after second spike (total 1300ms, but candidate reset at 800ms)
    now += 500;
    result = controller.update(0.5, 60.0, now);
    expect(result).toBeNull(); // hold window from 800ms has not passed 1000ms

    // 1050ms after second spike
    now += 550;
    result = controller.update(0.5, 60.0, now);
    expect(result).toBe('tense');
  });
});
