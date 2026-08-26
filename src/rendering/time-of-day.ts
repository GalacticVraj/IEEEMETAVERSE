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

export interface Palette {
  readonly sun: string;
  readonly ambient: string;
  /** Horizon colour. Fog shares it so the world dissolves into the sky. */
  readonly sky: string;
  /** Zenith colour — the top of the gradient dome. */
  readonly skyTop: string;
  readonly hemiSky: string;
  readonly hemiGround: string;
  readonly sunIntensity: number;
  readonly ambientIntensity: number;
  readonly hemiIntensity: number;
  /** Fog distances. Crisis haze closes the far plane in. */
  readonly fogNear: number;
  readonly fogFar: number;
}

export const DAY: Palette = {
  sun: '#FFF4E0',
  ambient: '#F5F7FA',
  sky: '#DDE3E8',
  skyTop: '#7FA8CC',
  hemiSky: '#CBD9E6',
  hemiGround: '#B8B2A6',
  sunIntensity: 1.6,
  ambientIntensity: 0.45,
  hemiIntensity: 0.5,
  fogNear: 420,
  fogFar: 1100,
};

export const DUSK: Palette = {
  sun: '#FF9E5C',
  ambient: '#D9C3B8',
  sky: '#E0A882',
  skyTop: '#4C5C86',
  hemiSky: '#D9A98C',
  hemiGround: '#8E8478',
  sunIntensity: 1.0,
  ambientIntensity: 0.34,
  hemiIntensity: 0.4,
  fogNear: 380,
  fogFar: 1000,
};

export const NIGHT: Palette = {
  sun: '#42527A',
  ambient: '#3A4560',
  sky: '#232E42',
  skyTop: '#0C1220',
  hemiSky: '#2E3A54',
  hemiGround: '#1E2432',
  sunIntensity: 0.18,
  ambientIntensity: 0.17,
  hemiIntensity: 0.22,
  fogNear: 320,
  fogFar: 900,
};

/**
 * Where the light goes when the grid is in trouble.
 *
 * This is NOT a mood setting: it is driven by `crisisGrade`, which is computed
 * from measured frequency deviation, corridor loading, dark districts, trips
 * and UFLS stage. A red horizon on this screen always means a real fault is on
 * the system, so the escalation teaches rather than decorates.
 */
export const CRISIS: Palette = {
  sun: '#FF6A38',
  ambient: '#B8735C',
  sky: '#8C3B27',
  skyTop: '#2A1420',
  hemiSky: '#A84C30',
  hemiGround: '#3A2018',
  sunIntensity: 1.05,
  ambientIntensity: 0.3,
  hemiIntensity: 0.34,
  fogNear: 220,
  fogFar: 720,
};

/**
 * The crisis palette never fully replaces the time of day — a blackout at
 * 15:00 still reads as afternoon, just a wrong-looking one. Capping the mix
 * keeps the dusk arc legible underneath the alarm.
 */
export const MAX_CRISIS_PUSH = 0.62;

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
