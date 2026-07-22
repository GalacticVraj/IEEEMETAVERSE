/**
 * shots.ts — the reusable shot library. PURE data + math, no three.js, no
 * React. Shots define FRAMING only (a position and a look-target); the
 * CameraDirector performs all interpolation. Every coordinate comes from the
 * shared layout tables — nothing is invented.
 */
import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';

import { BUS_POSITIONS, BUS_ZONE } from '../layout';

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export interface CameraPose {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

export interface Shot {
  readonly name: string;
  readonly pose: CameraPose;
}

export type TimingPreset = 'FAST' | 'NORMAL' | 'SLOW' | 'CINEMATIC';

/** Transition durations in seconds — frame-delta interpolation, never wall-clock tweens. */
export const TIMING_SECONDS: Record<TimingPreset, number> = {
  FAST: 0.7,
  NORMAL: 1.4,
  SLOW: 2.2,
  CINEMATIC: 3.2,
};

// ---------------------------------------------------------------------------
// Framing constraints (digital twin, not a game camera)
// ---------------------------------------------------------------------------

/** Never frame tighter than this — surrounding city context must stay visible. */
const MIN_FRAMING_DISTANCE = 55;
/** Ground-level interest height for look targets. */
const TARGET_HEIGHT = 5;

// ---------------------------------------------------------------------------
// The operator's stable home framing
// ---------------------------------------------------------------------------

export const OPERATOR_HOME: Shot = {
  name: 'OperatorHome',
  pose: { position: [10, 155, 215], target: [0, TARGET_HEIGHT, 0] },
};

/** Wide establishing frame of the whole city. */
export function frameCity(name = 'Meridian_Bay'): Shot {
  return { name, pose: { position: [-60, 250, 280], target: [0, 0, 0] } };
}

// ---------------------------------------------------------------------------
// Framing calculators
// ---------------------------------------------------------------------------

interface FrameOptions {
  readonly distance?: number;
  /** Elevation angle in radians above the horizon. */
  readonly elevation?: number;
  /** Azimuth in radians (0 = +z, matching the home view direction). */
  readonly azimuth?: number;
}

/** Frame a point asset (bus, generator, building) from a comfortable orbit. */
export function frameNode(name: string, at: readonly [number, number], options: FrameOptions = {}): Shot {
  const distance = Math.max(MIN_FRAMING_DISTANCE, options.distance ?? 80);
  const elevation = options.elevation ?? 0.62;
  const azimuth = options.azimuth ?? Math.PI * 0.22;
  const horizontal = distance * Math.cos(elevation);
  const [x, z] = at;
  return {
    name,
    pose: {
      target: [x, TARGET_HEIGHT, z],
      position: [
        x + horizontal * Math.sin(azimuth),
        TARGET_HEIGHT + distance * Math.sin(elevation),
        z + horizontal * Math.cos(azimuth),
      ],
    },
  };
}

/** Frame a corridor broadside: centered on its midpoint, distance ∝ length. */
export function frameLine(
  name: string,
  from: readonly [number, number],
  to: readonly [number, number],
): Shot {
  const mx = (from[0] + to[0]) / 2;
  const mz = (from[1] + to[1]) / 2;
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const distance = Math.min(200, Math.max(MIN_FRAMING_DISTANCE, length * 1.5));
  // Perpendicular azimuth → broadside view of the corridor.
  const azimuth = Math.atan2(dx, dz) + Math.PI / 2;
  return frameNode(name, [mx, mz], { distance, azimuth, elevation: 0.7 });
}

/** Frame a district: centroid + radius, from higher up for context. */
export function frameZone(name: string, centroid: readonly [number, number], radius: number): Shot {
  const distance = Math.min(260, Math.max(75, radius * 2.8));
  return frameNode(name, centroid, { distance, elevation: 0.85 });
}

/** Centroid of a zone's buses (from the shared layout — real coordinates). */
export function zoneCentroid(zoneId: string): [number, number] {
  const positions = Object.entries(BUS_ZONE)
    .filter(([, zone]) => zone === zoneId)
    .map(([busId]) => BUS_POSITIONS[busId])
    .filter((p): p is [number, number] => p !== undefined);
  if (positions.length === 0) return [0, 0];
  const cx = positions.reduce((s, p) => s + p[0], 0) / positions.length;
  const cz = positions.reduce((s, p) => s + p[1], 0) / positions.length;
  return [cx, cz];
}

/** Rough zone radius: max bus distance from the centroid + margin. */
export function zoneRadius(zoneId: string): number {
  const [cx, cz] = zoneCentroid(zoneId);
  const positions = Object.entries(BUS_ZONE)
    .filter(([, zone]) => zone === zoneId)
    .map(([busId]) => BUS_POSITIONS[busId])
    .filter((p): p is [number, number] => p !== undefined);
  const max = positions.reduce((m, p) => Math.max(m, Math.hypot(p[0] - cx, p[1] - cz)), 0);
  return max + 25;
}

// ---------------------------------------------------------------------------
// Event focus → shots (crisis choreography). Returns null rather than
// inventing a frame for unknown assets — the camera never fakes anything.
// ---------------------------------------------------------------------------

export type EventFocusKind = 'line' | 'generator' | 'zone' | 'city';

export interface EventFocus {
  readonly kind: EventFocusKind;
  readonly id: string;
}

export function shotForFocus(focus: EventFocus): Shot | null {
  if (focus.kind === 'city') return frameCity('Critical_CityWide');

  if (focus.kind === 'line') {
    const line = MERIDIAN_BAY_TOPOLOGY.lines.find((l) => (l.id as string) === focus.id);
    if (line === undefined) return null;
    const from = BUS_POSITIONS[line.from as string];
    const to = BUS_POSITIONS[line.to as string];
    if (from === undefined || to === undefined) return null;
    return frameLine('Critical_ProtectionTrip', from, to);
  }

  if (focus.kind === 'generator') {
    const generator = MERIDIAN_BAY_TOPOLOGY.generators.find((g) => (g.id as string) === focus.id);
    if (generator === undefined) return null;
    const at = BUS_POSITIONS[generator.node as string];
    if (at === undefined) return null;
    return frameNode('Inspect_Generator', at, { distance: 95, elevation: 0.55 });
  }

  // zone
  const known = MERIDIAN_BAY_TOPOLOGY.zones.some((z) => (z.id as string) === focus.id);
  if (!known) return null;
  return frameZone('Critical_Blackout', zoneCentroid(focus.id), zoneRadius(focus.id));
}

// ---------------------------------------------------------------------------
// Decision camera — player action → affected district
// ---------------------------------------------------------------------------

const DECISION_ZONES: readonly { readonly prefix: string; readonly zones: readonly string[] }[] = [
  { prefix: 'op-ac-residential', zones: ['RN', 'RS'] },
  { prefix: 'op-lights-commercial', zones: ['DT'] },
  { prefix: 'op-shed-industrial', zones: ['IN'] },
  { prefix: 'op-shed-harbor', zones: ['HB'] },
];

export function shotForDecision(decisionId: string): Shot | null {
  for (const mapping of DECISION_ZONES) {
    if (!decisionId.startsWith(mapping.prefix)) continue;
    if (mapping.zones.length === 1) {
      const zone = mapping.zones[0]!;
      return frameZone('Decision_Action', zoneCentroid(zone), zoneRadius(zone));
    }
    // Multi-zone: frame the midpoint of the centroids, wide enough for both.
    const centroids = mapping.zones.map(zoneCentroid);
    const cx = centroids.reduce((s, c) => s + c[0], 0) / centroids.length;
    const cz = centroids.reduce((s, c) => s + c[1], 0) / centroids.length;
    const spread = centroids.reduce((m, c) => Math.max(m, Math.hypot(c[0] - cx, c[1] - cz)), 0);
    return frameZone('Decision_Action', [cx, cz], spread + 45);
  }
  // City-wide actions (EV pause) and director-prompt decisions.
  if (decisionId.startsWith('op-ev-pause') || decisionId.startsWith('dec-')) {
    return frameCity('Decision_Action');
  }
  return null;
}

// ---------------------------------------------------------------------------
// Intro sequence — one continuous flight over real districts (8–10 s)
// ---------------------------------------------------------------------------

export interface IntroLeg {
  readonly caption: string;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

/**
 * Waypoints for the Catmull-Rom flight. Total nominal load (~895 MW) and
 * district roles come from the real topology. The director appends
 * OPERATOR_HOME as the final leg.
 */
export const INTRO_LEGS: readonly IntroLeg[] = [
  {
    caption: 'MERIDIAN BAY — a coastal grid serving six districts',
    position: [-190, 240, -220],
    target: [0, 0, 0],
  },
  {
    caption: 'GENERATION SOUTH — 400 MW baseload anchors the city',
    position: [130, 85, 100],
    target: [80, TARGET_HEIGHT, 65], // GS1
  },
  {
    caption: 'INDUSTRIAL DISTRICT — the heaviest single demand block',
    position: [115, 65, 12],
    target: [68, TARGET_HEIGHT, 15], // IN cluster
  },
  {
    caption: 'HARBOR — imports, shipping, and critical water treatment',
    position: [90, 62, -100],
    target: [57, TARGET_HEIGHT, -52], // HB cluster
  },
  {
    caption: 'MERIDIAN GENERAL — the hospital must never go dark',
    position: [58, 42, 40],
    target: [30, 10, 68], // DT-Hosp
  },
  {
    caption: 'DOWNTOWN — the commercial core',
    position: [14, 68, 12],
    target: [0, 12, 62], // DT cluster
  },
  {
    caption: 'RENEWABLES NORTH — solar and wind ride the weather',
    position: [-120, 70, 42],
    target: [-75, TARGET_HEIGHT, 80], // GN1
  },
  {
    caption: 'RESIDENTIAL DISTRICTS — the homes you keep powered',
    position: [-100, 82, -30],
    target: [-52, TARGET_HEIGHT, 5], // RN/RS spine
  },
];

export const INTRO_DURATION_S = 9.5;
