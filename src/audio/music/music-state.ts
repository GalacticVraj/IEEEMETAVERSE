/**
 * Pure music state machine & hysteresis controller for GridGuard.
 * Evaluates corridor stress ratio and frequency deviation to determine music tier.
 */

import type { MusicKey } from '../manifest';

export interface MusicStateThresholds {
  /** Stress ratio upper boundary for Calm tier (e.g., 0.40 for 40%) */
  readonly calmStressMax: number;
  /** Frequency deviation (Hz) upper boundary for Calm tier (e.g., 0.2 Hz) */
  readonly calmFreqDevMax: number;
  /** Stress ratio lower boundary for Critical tier (e.g., 0.75 for 75%) */
  readonly criticalStressMin: number;
  /** Frequency deviation (Hz) lower boundary for Critical tier (e.g., 0.5 Hz) */
  readonly criticalFreqDevMin: number;
  /** Sustained window in milliseconds required to commit a state transition (hysteresis) */
  readonly hysteresisHoldMs: number;
}

export const DEFAULT_MUSIC_THRESHOLDS: MusicStateThresholds = {
  calmStressMax: 0.4,
  calmFreqDevMax: 0.2,
  criticalStressMin: 0.75,
  criticalFreqDevMin: 0.5,
  hysteresisHoldMs: 2500,
};

/**
 * Pure function: maps live corridor stress ratio and frequency deviation to candidate music key.
 *
 * Threshold rules:
 * - Calm: stress < 40% AND freq deviation < 0.2 Hz
 * - Critical: stress > 75% OR freq deviation > 0.5 Hz
 * - Tense: stress 40–75% OR freq deviation 0.2–0.5 Hz
 */
export function getMusicState(
  stressRatio: number,
  freqHz: number,
  thresholds: MusicStateThresholds = DEFAULT_MUSIC_THRESHOLDS,
): MusicKey {
  const freqDeviation = Math.abs(freqHz - 50.0);

  if (
    stressRatio >= thresholds.criticalStressMin ||
    freqDeviation >= thresholds.criticalFreqDevMin
  ) {
    return 'critical';
  }

  if (stressRatio < thresholds.calmStressMax && freqDeviation < thresholds.calmFreqDevMax) {
    return 'calm';
  }

  return 'tense';
}

/**
 * Stateful controller that enforces hysteresis (hold duration) on music state transitions
 * so the soundtrack doesn't flap back and forth when stress oscillates around boundaries.
 */
export class MusicStateController {
  private currentState: MusicKey = 'calm';
  private pendingCandidate: MusicKey | null = null;
  private candidateFirstSeenMs = 0;

  constructor(
    initialState: MusicKey = 'calm',
    private readonly thresholds: MusicStateThresholds = DEFAULT_MUSIC_THRESHOLDS,
  ) {
    this.currentState = initialState;
  }

  public getCurrentState(): MusicKey {
    return this.currentState;
  }

  /**
   * Evaluates current grid telemetry against state rules with hysteresis.
   * Returns the new `MusicKey` if a transition was committed, or `null` if unchanged.
   */
  public update(stressRatio: number, freqHz: number, nowMs: number): MusicKey | null {
    const rawTarget = getMusicState(stressRatio, freqHz, this.thresholds);

    if (rawTarget === this.currentState) {
      this.pendingCandidate = null;
      return null;
    }

    if (this.pendingCandidate !== rawTarget) {
      this.pendingCandidate = rawTarget;
      this.candidateFirstSeenMs = nowMs;
      return null;
    }

    const elapsed = nowMs - this.candidateFirstSeenMs;
    if (elapsed >= this.thresholds.hysteresisHoldMs) {
      this.currentState = rawTarget;
      this.pendingCandidate = null;
      return rawTarget;
    }

    return null;
  }

  public reset(state: MusicKey = 'calm'): void {
    this.currentState = state;
    this.pendingCandidate = null;
    this.candidateFirstSeenMs = 0;
  }
}
