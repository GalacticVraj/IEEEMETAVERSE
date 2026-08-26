/**
 * TimeOfDayRig — the scene's ONE lighting rig.
 *
 * Two inputs, both of them real simulation output:
 *
 *   1. the tick, which drives the afternoon → dusk → night arc, and
 *   2. the crisis grade, a pure display mapping of measured frequency
 *      deviation, corridor loading, dark districts, line trips and UFLS stage.
 *
 * The second is new, and it is the answer to "a CRITICAL storm looks identical
 * to a calm grid". The sun, the ambient fill, the horizon, the fog depth and
 * the sky dome all push toward the crisis palette in proportion to how much
 * trouble the grid is actually in — so the room going amber is evidence, not
 * decoration. The push is capped (`MAX_CRISIS_PUSH`) so the time of day stays
 * legible underneath it.
 *
 * No React state, no allocations in the frame loop; colours are preallocated
 * and written imperatively.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';

import { useGridStore, useSimulationStore } from '@state';

import { GRADE_LERP_PER_SECOND, crisisGrade } from './severity';
import { CRISIS, MAX_CRISIS_PUSH, nightFactor, paletteAt, sunPosition } from './time-of-day';

/** A gradient dome instead of a flat background colour. */
const SKY_RADIUS = 1000;

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  varying vec3 vDirection;
  void main() {
    // Weighted toward the horizon so the gradient reads as atmosphere rather
    // than as a two-stop ramp.
    float h = smoothstep(-0.08, 0.62, vDirection.y);
    gl_FragColor = vec4(mix(horizonColor, topColor, h), 1.0);
  }
`;

export function TimeOfDayRig(): ReactElement {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  /** Smoothed crisis grade — a relay opens instantly, the light must not. */
  const gradeRef = useRef(0);

  // Preallocated working colours and the sky uniforms, reused every frame.
  const work = useMemo(
    () => ({
      a: new THREE.Color(),
      b: new THREE.Color(),
      sky: new THREE.Color('#DDE3E8'),
      crisisSun: new THREE.Color(CRISIS.sun),
      crisisAmbient: new THREE.Color(CRISIS.ambient),
      crisisSky: new THREE.Color(CRISIS.sky),
      crisisSkyTop: new THREE.Color(CRISIS.skyTop),
      crisisHemiSky: new THREE.Color(CRISIS.hemiSky),
      crisisHemiGround: new THREE.Color(CRISIS.hemiGround),
    }),
    [],
  );

  const skyUniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color('#7FA8CC') },
      horizonColor: { value: new THREE.Color('#DDE3E8') },
    }),
    [],
  );

  useFrame(({ scene }, delta) => {
    const grid = useGridStore.getState();
    const tick = grid.tick;
    const f = nightFactor(tick);
    const { from, to, t } = paletteAt(f);

    // --- crisis grade, smoothed -------------------------------------------
    const target = crisisGrade({
      frequencyHz: grid.frequency,
      maxLoading: useSimulationStore.getState().maxLineLoading,
      darkZones: grid.zones.filter((z) => z.state === 'Blackout').length,
      totalZones: grid.zones.length,
      trippedLines: grid.trippedCount,
      uflsStage: grid.uflsStage,
    });
    gradeRef.current += (target - gradeRef.current) * Math.min(1, delta * GRADE_LERP_PER_SECOND);
    const push = gradeRef.current * MAX_CRISIS_PUSH;

    const lerpNumber = (a: number, b: number): number => a + (b - a) * t;
    const toCrisis = (base: number, crisis: number): number => base + (crisis - base) * push;

    // --- sun ---------------------------------------------------------------
    const sun = sunRef.current;
    if (sun !== null) {
      sun.color.set(from.sun).lerp(work.a.set(to.sun), t).lerp(work.crisisSun, push);
      sun.intensity = toCrisis(lerpNumber(from.sunIntensity, to.sunIntensity), CRISIS.sunIntensity);
      const [x, y, z] = sunPosition(f);
      sun.position.set(x, y, z);
    }

    // --- ambient fill ------------------------------------------------------
    const ambient = ambientRef.current;
    if (ambient !== null) {
      ambient.color
        .set(from.ambient)
        .lerp(work.a.set(to.ambient), t)
        .lerp(work.crisisAmbient, push);
      ambient.intensity = toCrisis(
        lerpNumber(from.ambientIntensity, to.ambientIntensity),
        CRISIS.ambientIntensity,
      );
    }

    // --- hemisphere --------------------------------------------------------
    const hemi = hemiRef.current;
    if (hemi !== null) {
      hemi.color.set(from.hemiSky).lerp(work.a.set(to.hemiSky), t).lerp(work.crisisHemiSky, push);
      hemi.groundColor
        .set(from.hemiGround)
        .lerp(work.b.set(to.hemiGround), t)
        .lerp(work.crisisHemiGround, push);
      hemi.intensity = toCrisis(
        lerpNumber(from.hemiIntensity, to.hemiIntensity),
        CRISIS.hemiIntensity,
      );
    }

    // --- horizon, fog and dome share one colour ---------------------------
    work.sky.set(from.sky).lerp(work.a.set(to.sky), t).lerp(work.crisisSky, push);
    skyUniforms.horizonColor.value.copy(work.sky);
    skyUniforms.topColor.value
      .set(from.skyTop)
      .lerp(work.a.set(to.skyTop), t)
      .lerp(work.crisisSkyTop, push);

    // --- fog ---------------------------------------------------------------
    const fog = scene.fog;
    if (fog !== null) {
      fog.color.copy(work.sky);
      if (fog instanceof THREE.Fog) {
        const near = lerpNumber(from.fogNear, to.fogNear);
        const far = lerpNumber(from.fogFar, to.fogFar);
        // Crisis haze closes the world in — the city literally becomes harder
        // to see the worse the grid gets.
        fog.near = toCrisis(near, CRISIS.fogNear);
        fog.far = toCrisis(far, CRISIS.fogFar);
      }
    }

    // The scene background is now the dome; keep the clear colour matched so
    // any frame the dome misses (extreme near-plane clipping) never flashes.
    if (scene.background instanceof THREE.Color) scene.background.copy(work.sky);
  });

  return (
    <>
      {/* Gradient sky dome. Replaces the flat background colour, which read as
          "no sky" on every wide shot. Unfogged and depth-write-free so it can
          never occlude the world it sits behind. */}
      <mesh renderOrder={-1000} frustumCulled={false}>
        <sphereGeometry args={[SKY_RADIUS, 32, 20]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
          uniforms={skyUniforms}
          vertexShader={SKY_VERTEX}
          fragmentShader={SKY_FRAGMENT}
        />
      </mesh>

      <directionalLight
        ref={sunRef}
        position={[80, 140, 60]}
        intensity={1.6}
        color="#FFF4E0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
        shadow-camera-near={10}
        shadow-camera-far={450}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
      />
      <ambientLight ref={ambientRef} intensity={0.45} color="#F5F7FA" />
      <hemisphereLight ref={hemiRef} args={['#CBD9E6', '#B8B2A6', 0.5]} />
    </>
  );
}
