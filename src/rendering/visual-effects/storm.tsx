/**
 * storm.tsx — lightning, and only while the weather model says Storm.
 *
 * "Coastal Storm" is a named scenario that used to look exactly like a clear
 * afternoon: the weather model published `WeatherChanged`, the event log wrote
 * a line about it, and the scene never heard. This is the scene hearing.
 *
 * This module owns the LIGHT only — two hard pulses and a horizon pop, which
 * announce a storm for the cost of a single directional light. The rain that
 * was once declined here now lives in `rain.tsx`, built densely enough to
 * read rather than half-committed, which was the actual objection.
 *
 * Strike RATE scales with measured corridor stress, so the sky gets more
 * violent as the grid approaches its limits — see `gapTicks`.
 *
 * Timing is derived from the SIMULATION TICK, not from wall-clock or
 * `Math.random()`. That keeps strikes deterministic — the same seed replays
 * the same storm — and it means the sky stops flashing the moment the sim is
 * paused, exactly like every other effect in the scene. The precedent is
 * `flickerAt` in city-layout.ts.
 */
import { useGridStore } from '@state';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { ReactElement } from 'react';
import type * as THREE from 'three';

/** Ticks between strikes, before jitter. The sim runs at 10 ticks/second. */
const BASE_INTERVAL_TICKS = 55;
/** Deterministic jitter band, in ticks. */
const JITTER_TICKS = 45;

/** Flash envelope length, seconds. */
const FLASH_SECONDS = 0.42;
/** Peak intensity of the strike light. */
const PEAK_INTENSITY = 5.2;

/**
 * Deterministic hash → [0, 1). Same shape as `flickerAt`'s: cheap, stable, and
 * free of the non-seeded randomness that has no business in a render path.
 */
function hash01(n: number): number {
  const x = Math.sin(n * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Ticks to wait after strike `index` before the next one.
 *
 * `stress` is the worst corridor loading right now, 0..1. The strike rate
 * closes up as the grid is pushed harder — at full stress the gap is 45 % of
 * its calm value. That is a presentation choice with a traceable cause, not a
 * physical claim: lightning does not know about line loading, but the storm
 * SCENE getting more violent as the corridors approach their limits is the
 * scene reporting the grid's condition, which is this renderer's whole job.
 */
function gapTicks(index: number, stress: number): number {
  const base = BASE_INTERVAL_TICKS + Math.floor(hash01(index + 1) * JITTER_TICKS);
  const urgency = 1 - 0.55 * Math.min(1, Math.max(0, stress));
  return Math.max(8, Math.round(base * urgency));
}

/**
 * Two-pulse envelope. A single decaying spike reads as a lamp switching on;
 * real lightning strobes, and the second, weaker pulse is what sells it.
 */
function envelope(age: number): number {
  if (age < 0 || age > FLASH_SECONDS) return 0;
  const t = age / FLASH_SECONDS;
  const first = Math.max(0, 1 - t * 6);
  const second = Math.max(0, 1 - Math.abs(t - 0.42) * 9) * 0.62;
  return Math.max(first, second);
}

export function StormEffects(): ReactElement {
  const flashRef = useRef<THREE.DirectionalLight>(null);
  const ageRef = useRef(Infinity);
  const strikeIndexRef = useRef(0);
  /** Advanced incrementally — never recomputed by replaying the schedule. */
  const nextStrikeTickRef = useRef(-1);
  const lastTickRef = useRef(0);

  useFrame((_, delta) => {
    const light = flashRef.current;
    if (light === null) return;

    const { weatherKind, tick, lines } = useGridStore.getState();
    // Worst corridor loading right now — the same measured quantity the crisis
    // ladder and the corridor colours read.
    let stress = 0;
    for (const line of lines) stress = Math.max(stress, line.loading);

    if (weatherKind !== 'Storm') {
      light.intensity = 0;
      // Re-arm so a storm arriving later starts its schedule from that point
      // rather than firing a burst of backdated strikes.
      strikeIndexRef.current = 0;
      nextStrikeTickRef.current = -1;
      lastTickRef.current = tick;
      ageRef.current = Infinity;
      return;
    }

    // A restart rewinds the tick; rewind the schedule with it.
    if (tick < lastTickRef.current) {
      strikeIndexRef.current = 0;
      nextStrikeTickRef.current = -1;
      ageRef.current = Infinity;
    }
    lastTickRef.current = tick;

    // First frame of a storm: arm the schedule relative to now.
    if (nextStrikeTickRef.current < 0) {
      nextStrikeTickRef.current = tick + gapTicks(strikeIndexRef.current, stress);
    } else if (tick >= nextStrikeTickRef.current) {
      strikeIndexRef.current += 1;
      nextStrikeTickRef.current = tick + gapTicks(strikeIndexRef.current, stress);
      ageRef.current = 0;
    }

    ageRef.current += delta;
    light.intensity = envelope(ageRef.current) * PEAK_INTENSITY;
  });

  return (
    <directionalLight
      ref={flashRef}
      // High and offshore, so the flash rakes the city from the seaward side
      // the weather is coming from.
      position={[320, 400, -180]}
      intensity={0}
      color="#D8E6FF"
    />
  );
}
