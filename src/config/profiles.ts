import { DEFAULT_TICK_RATE_HZ, DEFAULT_TIMESTEP, MAX_DEVICE_PIXEL_RATIO } from '@constants';

import type { AppConfig, AppProfile } from './schema';

const DEV_SEED = 1;
const DEMO_SEED = 42;
const COMPETITION_SEED = 7;

const baseSimulation = {
  timestep: DEFAULT_TIMESTEP,
  tickRateHz: DEFAULT_TICK_RATE_HZ,
} as const;

/**
 * The concrete configuration for each profile. Real data (not a placeholder):
 * these are the actual tunables the app runs with.
 *
 * - development  — everything on, verbose, debug overlay visible.
 * - demo         — full visuals, fixed seed for a repeatable showcase.
 * - production   — full visuals, quiet logging, overlay off.
 * - competition  — deterministic seed + overlay off for a judged run.
 */
export const PROFILES: Record<AppProfile, AppConfig> = {
  development: {
    profile: 'development',
    simulation: { ...baseSimulation, seed: DEV_SEED },
    render: { maxPixelRatio: MAX_DEVICE_PIXEL_RATIO, postProcessing: true, shadows: true },
    debug: { overlay: true, logLevel: 'debug' },
  },
  demo: {
    profile: 'demo',
    simulation: { ...baseSimulation, seed: DEMO_SEED },
    render: { maxPixelRatio: MAX_DEVICE_PIXEL_RATIO, postProcessing: true, shadows: true },
    debug: { overlay: false, logLevel: 'info' },
  },
  production: {
    profile: 'production',
    simulation: { ...baseSimulation, seed: DEMO_SEED },
    render: { maxPixelRatio: MAX_DEVICE_PIXEL_RATIO, postProcessing: true, shadows: true },
    debug: { overlay: false, logLevel: 'warn' },
  },
  competition: {
    profile: 'competition',
    simulation: { ...baseSimulation, seed: COMPETITION_SEED },
    render: { maxPixelRatio: MAX_DEVICE_PIXEL_RATIO, postProcessing: true, shadows: true },
    debug: { overlay: false, logLevel: 'info' },
  },
};
