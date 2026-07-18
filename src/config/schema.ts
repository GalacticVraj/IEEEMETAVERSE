import type { Seconds } from '@app-types';

/** The four supported runtime profiles. */
export type AppProfile = 'development' | 'demo' | 'production' | 'competition';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SimulationConfig {
  /** Deterministic run seed. */
  readonly seed: number;
  readonly timestep: Seconds;
  readonly tickRateHz: number;
}

export interface RenderConfig {
  readonly maxPixelRatio: number;
  readonly postProcessing: boolean;
  readonly shadows: boolean;
}

export interface DebugConfig {
  readonly overlay: boolean;
  readonly logLevel: LogLevel;
}

/**
 * The fully-resolved application configuration. Every configurable value lives
 * here — no hardcoded tunables elsewhere. Assembled per profile in `profiles.ts`.
 */
export interface AppConfig {
  readonly profile: AppProfile;
  readonly simulation: SimulationConfig;
  readonly render: RenderConfig;
  readonly debug: DebugConfig;
}
