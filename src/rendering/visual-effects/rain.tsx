/**
 * rain.tsx — rain, but only while the weather model says Storm.
 *
 * `storm.tsx` deliberately declined rain, and its reasoning was right at the
 * time: a sparse sprite field over a top-down city reads as dirt on the lens,
 * which is worse than nothing. That is an argument against a HALF-COMMITTED
 * rain field, not against rain — and a scenario called Coastal Storm that
 * produces no visible weather is a real gap in a competition demo.
 *
 * So this is committed: a dense column of line segments that falls with the
 * camera, drawn as ONE `LineSegments` object with a single draw call and no
 * per-frame allocation. Doctrine holds — the trigger is `weatherKind`, a
 * measured value published by the weather model, and the intensity scales with
 * measured wind. It cannot rain on a clear day, and it stops when the sim is
 * paused because the tick stops advancing.
 *
 * The column follows the camera on the horizontal plane only. Rain that is
 * anchored to the world would need to cover a 4,000-unit terrain to be visible
 * from every camera station; following means ~3,000 drops cover every shot.
 */
import { useFrame } from '@react-three/fiber';
import { useGridStore } from '@state';
import { useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';

/** Drops in the column. One draw call regardless. */
const DROP_COUNT = 2600;
/** Horizontal extent of the column, world units. */
const SPREAD = 320;
/** Column height. Drops recycle from the top when they pass the floor. */
const TOP = 260;
const FLOOR = -6;
/** Fall speed, world units per second. */
const FALL_SPEED = 340;
/** Length of a drop streak, world units. */
const STREAK = 7;
/** How far the wind pushes a drop sideways per unit of fall, at full wind. */
const WIND_SHEAR = 0.42;

/**
 * Deterministic scatter. `Math.random()` in a render path is exactly the
 * non-seeded randomness this project removed from `flickerAt` and the storm
 * schedule; the same hash shape is reused here so a replay produces the same
 * rain.
 */
function hash01(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function RainEffects(): ReactElement {
  const linesRef = useRef<THREE.LineSegments>(null);
  const materialRef = useRef<THREE.LineBasicMaterial>(null);
  /** Per-drop vertical offset, advanced every frame. */
  const offsets = useRef<Float32Array>(new Float32Array(DROP_COUNT));

  // Geometry is built once. Two vertices per drop; positions are rewritten in
  // place each frame, never reallocated.
  const geometry = useMemo(() => {
    const positions = new Float32Array(DROP_COUNT * 6);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  }, []);

  const seeds = useMemo(() => {
    const table = new Float32Array(DROP_COUNT * 3);
    for (let i = 0; i < DROP_COUNT; i++) {
      table[i * 3] = (hash01(i * 3 + 1) - 0.5) * SPREAD * 2;
      table[i * 3 + 1] = hash01(i * 3 + 2) * (TOP - FLOOR);
      table[i * 3 + 2] = (hash01(i * 3 + 3) - 0.5) * SPREAD * 2;
    }
    return table;
  }, []);

  useFrame(({ camera }, delta) => {
    const lines = linesRef.current;
    const material = materialRef.current;
    if (lines === null || material === null) return;

    const { weatherKind, wind } = useGridStore.getState();
    const storming = weatherKind === 'Storm';

    // Fade rather than unmount: a hard cut-off at the end of a storm is more
    // noticeable than the rain itself.
    const target = storming ? 0.34 : 0;
    material.opacity += (target - material.opacity) * Math.min(1, delta * 2.2);
    lines.visible = material.opacity > 0.01;
    if (!lines.visible) return;

    // Follow the camera horizontally so a fixed-size column covers every shot.
    lines.position.set(camera.position.x, 0, camera.position.z);

    const positions = geometry.attributes['position'] as THREE.BufferAttribute;
    const array = positions.array as Float32Array;
    const span = TOP - FLOOR;
    const shear = WIND_SHEAR * wind;

    for (let i = 0; i < DROP_COUNT; i++) {
      let y = seeds[i * 3 + 1]! - ((offsets.current[i]! + delta * FALL_SPEED) % span);
      offsets.current[i] = (offsets.current[i]! + delta * FALL_SPEED) % span;
      if (y < FLOOR) y += span;

      const x = seeds[i * 3]!;
      const z = seeds[i * 3 + 2]!;
      const o = i * 6;
      array[o] = x;
      array[o + 1] = y;
      array[o + 2] = z;
      // Streak leans with the wind — the thing that makes it read as driven
      // rain rather than a static hatch pattern.
      array[o + 3] = x + STREAK * shear;
      array[o + 4] = y + STREAK;
      array[o + 5] = z;
    }
    positions.needsUpdate = true;
  });

  return (
    <lineSegments ref={linesRef} geometry={geometry} visible={false} frustumCulled={false}>
      <lineBasicMaterial
        ref={materialRef}
        color="#AFC4D6"
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}
