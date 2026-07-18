import { asHertz, asSeconds } from '@app-types';
import type { Hertz, Seconds } from '@app-types';

/**
 * Named simulation constants. NO magic numbers may appear in engine code —
 * every physical or timing quantity is named and documented here (or supplied
 * through configuration profiles for values that vary per profile).
 */

/** Nominal grid frequency for a 60 Hz interconnection (North America). */
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- this literal IS the named constant
export const NOMINAL_FREQUENCY: Hertz = asHertz(60);

/** Default simulation update rate (ticks per second of simulated time). */
export const DEFAULT_TICK_RATE_HZ = 10;

/** Fixed timestep in simulated seconds, derived from the default tick rate. */
export const DEFAULT_TIMESTEP: Seconds = asSeconds(1 / DEFAULT_TICK_RATE_HZ);

/** Per-unit line loading at/above which a line is considered overloaded. */
export const OVERLOAD_THRESHOLD_PU = 1.0;

/** Per-unit loading at/above which protection begins a trip sequence. */
export const TRIP_THRESHOLD_PU = 1.25;

/** Ratio of nominal voltage below which a zone is considered blacked out. */
export const BLACKOUT_VOLTAGE_PU = 0.5;

/** Upper bound applied to device pixel ratio for adaptive rendering cost. */
export const MAX_DEVICE_PIXEL_RATIO = 2;
