/**
 * TimeOfDayRig — the scene's ONE lighting rig, driven by the simulation tick.
 * Lerps sun/ambient/hemisphere/sky/fog through afternoon → dusk → night.
 * No React state, no allocations in the frame loop; colors are preallocated
 * and written imperatively.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';

import { useGridStore } from '@state';

import { nightFactor, paletteAt, sunPosition } from './time-of-day';

export function TimeOfDayRig(): ReactElement {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);

  // Preallocated working colors — reused every frame.
  const work = useMemo(
    () => ({
      a: new THREE.Color(),
      b: new THREE.Color(),
      sky: new THREE.Color('#DDE3E8'),
    }),
    [],
  );

  useFrame(({ scene }) => {
    const tick = useGridStore.getState().tick;
    const f = nightFactor(tick);
    const { from, to, t } = paletteAt(f);

    const sun = sunRef.current;
    if (sun !== null) {
      sun.color.set(from.sun).lerp(work.a.set(to.sun), t);
      sun.intensity = from.sunIntensity + (to.sunIntensity - from.sunIntensity) * t;
      const [x, y, z] = sunPosition(f);
      sun.position.set(x, y, z);
    }

    const ambient = ambientRef.current;
    if (ambient !== null) {
      ambient.color.set(from.ambient).lerp(work.a.set(to.ambient), t);
      ambient.intensity = from.ambientIntensity + (to.ambientIntensity - from.ambientIntensity) * t;
    }

    const hemi = hemiRef.current;
    if (hemi !== null) {
      hemi.color.set(from.hemiSky).lerp(work.a.set(to.hemiSky), t);
      hemi.groundColor.set(from.hemiGround).lerp(work.b.set(to.hemiGround), t);
      hemi.intensity = from.hemiIntensity + (to.hemiIntensity - from.hemiIntensity) * t;
    }

    // Sky + fog share one horizon color.
    work.sky.set(from.sky).lerp(work.a.set(to.sky), t);
    if (scene.background instanceof THREE.Color) scene.background.copy(work.sky);
    if (scene.fog !== null) scene.fog.color.copy(work.sky);
  });

  return (
    <>
      <directionalLight
        ref={sunRef}
        position={[80, 140, 60]}
        intensity={1.6}
        color="#FFF4E0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <ambientLight ref={ambientRef} intensity={0.45} color="#F5F7FA" />
      <hemisphereLight ref={hemiRef} args={['#CBD9E6', '#B8B2A6', 0.5]} />
    </>
  );
}
