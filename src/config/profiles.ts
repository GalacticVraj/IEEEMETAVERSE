import {
  DEFAULT_TICK_RATE_HZ,
  DEFAULT_TIMESTEP,
  MAX_DEVICE_PIXEL_RATIO,
  MAX_EVENT_LISTENERS,
} from '@constants';

import type { AppConfig, AppProfile } from './schema';

const DEV_SEED = 1;
const DEMO_SEED = 42;
const COMPETITION_SEED = 7;

const baseSimulation = {
  timestep: DEFAULT_TIMESTEP,
  tickRateHz: DEFAULT_TICK_RATE_HZ,
} as const;

const baseRender = {
  maxPixelRatio: MAX_DEVICE_PIXEL_RATIO,
  postProcessing: true,
  shadows: true,
} as const;

/**
 * The concrete configuration for each profile. Real data (not a placeholder):
 * these are the actual tunables the app runs with.
 *
 * - development  — everything on, verbose, debug overlay + diagnostics.
 * - demo         — full visuals, fixed seed for a repeatable showcase.
 * - production   — full visuals, quiet logging, overlay off, diagnostics off.
 * - competition  — MAXIMUM determinism: fixed seed, frozen payloads, full
 *                  diagnostics, overlay off — for a judged, reproducible run.
 */
export const PROFILES: Record<AppProfile, AppConfig> = {
  development: {
    profile: 'development',
    simulation: { ...baseSimulation, seed: DEV_SEED },
    render: { ...baseRender },
    debug: { overlay: true, logLevel: 'debug' },
    kernel: { freezePayloads: false, leakThreshold: MAX_EVENT_LISTENERS, diagnostics: true },
  },
  demo: {
    profile: 'demo',
    simulation: { ...baseSimulation, seed: DEMO_SEED },
    render: { ...baseRender },
    debug: { overlay: false, logLevel: 'info' },
    kernel: { freezePayloads: false, leakThreshold: MAX_EVENT_LISTENERS, diagnostics: true },
  },
  production: {
    profile: 'production',
    simulation: { ...baseSimulation, seed: DEMO_SEED },
    render: { ...baseRender },
    debug: { overlay: false, logLevel: 'warn' },
    kernel: { freezePayloads: false, leakThreshold: MAX_EVENT_LISTENERS, diagnostics: false },
  },
  competition: {
    profile: 'competition',
    simulation: { ...baseSimulation, seed: COMPETITION_SEED },
    render: { ...baseRender },
    debug: { overlay: false, logLevel: 'info' },
    kernel: { freezePayloads: true, leakThreshold: MAX_EVENT_LISTENERS, diagnostics: true },
  },
};
