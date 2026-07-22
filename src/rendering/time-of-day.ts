/**
 * time-of-day.ts — pure helpers for the dusk arc.
 *
 * The 1,800-tick shift compresses late afternoon → night. This is BOTH the
 * physics story (heatwave demand peaks into the evening) and the emotional
 * one: as the city lights come on, a blackout finally LOOKS like a blackout.
 * Everything derives from the sim tick — deterministic, pauses with the sim.
 */

export const RUN_TICKS = 1800;

/** 0 = full daylight, 1 = night. Daylight holds through the first third. */
export function nightFactor(tick: number): number {
  const progress = Math.min(1, Math.max(0, tick / RUN_TICKS));
  const t = Math.max(0, (progress - 0.3) / 0.6);
  const clamped = Math.min(1, t);
  return clamped * clamped * (3 - 2 * clamped); // smoothstep
}

interface Palette {
  readonly sun: string;
  readonly ambient: string;
  readonly sky: string;
  readonly hemiSky: string;
  readonly hemiGround: string;
  readonly sunIntensity: number;
  readonly ambientIntensity: number;
  readonly hemiIntensity: number;
}

export const DAY: Palette = {
  sun: '#FFF4E0',
  ambient: '#F5F7FA',
  sky: '#DDE3E8',
  hemiSky: '#CBD9E6',
  hemiGround: '#B8B2A6',
  sunIntensity: 1.6,
  ambientIntensity: 0.45,
  hemiIntensity: 0.5,
};

export const DUSK: Palette = {
  sun: '#FF9E5C',
  ambient: '#D9C3B8',
  sky: '#C9BFC4',
  hemiSky: '#D9A98C',
  hemiGround: '#8E8478',
  sunIntensity: 1.0,
  ambientIntensity: 0.34,
  hemiIntensity: 0.4,
};

export const NIGHT: Palette = {
  sun: '#42527A',
  ambient: '#3A4560',
  sky: '#232E42',
  hemiSky: '#2E3A54',
  hemiGround: '#1E2432',
  sunIntensity: 0.18,
  ambientIntensity: 0.17,
  hemiIntensity: 0.22,
};

/** Piecewise palette sample: day→dusk over f∈[0,0.55], dusk→night after. */
export function paletteAt(f: number): { from: Palette; to: Palette; t: number } {
  const DUSK_POINT = 0.55;
  if (f <= DUSK_POINT) return { from: DAY, to: DUSK, t: f / DUSK_POINT };
  return { from: DUSK, to: NIGHT, t: (f - DUSK_POINT) / (1 - DUSK_POINT) };
}

/** Sun position: arcs down toward the western horizon as night falls. */
export function sunPosition(f: number): readonly [number, number, number] {
  return [80 - 190 * f, 140 - 128 * f, 60 + 30 * f];
}

/** How strongly building windows glow (multiplies daylight emissives). */
export function windowGlow(f: number): number {
  return 1 + f * 7;
}
