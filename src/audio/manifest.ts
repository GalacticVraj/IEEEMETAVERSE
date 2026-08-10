/**
 * Audio Asset Manifest for GridGuard.
 * Maps event SFX keys and dynamic music stem names to static public audio files.
 */

export type SfxKey =
  | 'ui.click'
  | 'action.commit'
  | 'action.error'
  | 'grid.breakerTrip'
  | 'grid.blackout'
  | 'grid.generatorLost'
  | 'grid.stressEscalation'
  | 'shift.start'
  | 'shift.end'
  | 'tour.step'
  | 'rating.reveal';

export type MusicKey = 'calm' | 'tense' | 'critical';

export interface SfxDefinition {
  readonly src: string;
  readonly volume?: number;
  /** Fallback procedural tone params if file missing/load error */
  readonly fallbackTone?: {
    readonly freq: number;
    readonly type?: OscillatorType;
    readonly durationS: number;
  };
}

export interface MusicDefinition {
  readonly src: string;
  readonly loop: boolean;
  readonly loopLengthSec?: number;
}

export const SFX_MANIFEST: Record<SfxKey, SfxDefinition> = {
  'ui.click': {
    src: '/audio/sfx/ui-click.mp3',
    volume: 0.5,
    fallbackTone: { freq: 980, type: 'square', durationS: 0.04 },
  },
  'action.commit': {
    src: '/audio/sfx/action-commit.mp3',
    volume: 0.7,
    fallbackTone: { freq: 520, type: 'sine', durationS: 0.12 },
  },
  'action.error': {
    src: '/audio/sfx/action-error.mp3',
    volume: 0.7,
    fallbackTone: { freq: 180, type: 'sawtooth', durationS: 0.25 },
  },
  'grid.breakerTrip': {
    src: '/audio/sfx/breaker-trip.mp3',
    volume: 0.85,
    fallbackTone: { freq: 110, type: 'sawtooth', durationS: 0.35 },
  },
  'grid.blackout': {
    src: '/audio/sfx/blackout.mp3',
    volume: 0.9,
    fallbackTone: { freq: 60, type: 'sine', durationS: 0.8 },
  },
  'grid.generatorLost': {
    src: '/audio/sfx/generator-lost.mp3',
    volume: 0.85,
    fallbackTone: { freq: 90, type: 'sawtooth', durationS: 0.6 },
  },
  'grid.stressEscalation': {
    src: '/audio/sfx/stress-escalation.mp3',
    volume: 0.75,
    fallbackTone: { freq: 440, type: 'triangle', durationS: 0.2 },
  },
  'shift.start': {
    src: '/audio/sfx/shift-start.mp3',
    volume: 0.7,
    fallbackTone: { freq: 350, type: 'sine', durationS: 0.3 },
  },
  'shift.end': {
    src: '/audio/sfx/shift-end.mp3',
    volume: 0.7,
    fallbackTone: { freq: 523, type: 'sine', durationS: 0.4 },
  },
  'tour.step': {
    src: '/audio/sfx/tour-step.mp3',
    volume: 0.5,
    fallbackTone: { freq: 800, type: 'sine', durationS: 0.05 },
  },
  'rating.reveal': {
    src: '/audio/sfx/rating-reveal.mp3',
    volume: 0.8,
    fallbackTone: { freq: 659, type: 'triangle', durationS: 0.5 },
  },
};

export const MUSIC_MANIFEST: Record<MusicKey, MusicDefinition> = {
  calm: {
    src: '/audio/music/calm.mp3',
    loop: true,
    loopLengthSec: 16,
  },
  tense: {
    src: '/audio/music/tense.mp3',
    loop: true,
    loopLengthSec: 16,
  },
  critical: {
    src: '/audio/music/critical.mp3',
    loop: true,
    loopLengthSec: 16,
  },
};
