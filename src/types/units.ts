import type { Brand } from './brand';

/**
 * Branded physical units. Electrical simulation mixes many `number` quantities
 * that must never be accidentally interchanged (megawatts vs. per-unit voltage
 * vs. seconds). Branding makes unit mismatches a compile error.
 *
 * Runtime representation is always a plain `number`; the brand is erased.
 */
export type MegaWatts = Brand<number, 'MegaWatts'>;
export type MegaVars = Brand<number, 'MegaVars'>;
export type MegaVoltAmps = Brand<number, 'MegaVoltAmps'>;
export type PerUnit = Brand<number, 'PerUnit'>;
export type Hertz = Brand<number, 'Hertz'>;
export type Celsius = Brand<number, 'Celsius'>;
export type Seconds = Brand<number, 'Seconds'>;
export type Milliseconds = Brand<number, 'Milliseconds'>;
/** A dimensionless 0..1 ratio (loading, utilisation, probability). */
export type Ratio = Brand<number, 'Ratio'>;

export const asMegaWatts = (value: number): MegaWatts => value as MegaWatts;
export const asMegaVars = (value: number): MegaVars => value as MegaVars;
export const asMegaVoltAmps = (value: number): MegaVoltAmps => value as MegaVoltAmps;
export const asPerUnit = (value: number): PerUnit => value as PerUnit;
export const asHertz = (value: number): Hertz => value as Hertz;
export const asCelsius = (value: number): Celsius => value as Celsius;
export const asSeconds = (value: number): Seconds => value as Seconds;
export const asMilliseconds = (value: number): Milliseconds => value as Milliseconds;
export const asRatio = (value: number): Ratio => value as Ratio;
