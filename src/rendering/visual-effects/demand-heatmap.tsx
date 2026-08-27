/**
 * demand-heatmap.tsx — where the heating load actually is.
 *
 * The cold-snap scenario's distinctive mechanic. In a freeze the interesting
 * quantity is not total demand, it is WHICH districts are carrying it: the
 * residential blocks pull far above their nominal profile while industry
 * barely moves, and that imbalance is what overloads distribution corridors
 * in one corner of the city while the rest looks comfortable.
 *
 * Every input is measured. The ratio is each district's live demand over its
 * nominal profile from the static load table, and the overlay only appears
 * when the weather model reports a genuinely cold ambient — so it cannot show
 * up in a heatwave, and it cannot be switched on by anything but the physics.
 *
 * One disc per district, mounted for the whole run, animating opacity toward a
 * target. Same pattern as `outage.tsx` and for the same reason: no geometry is
 * allocated while the grid is falling over.
 */
import { useFrame } from '@react-three/fiber';
import { useGridStore } from '@state';
import { useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';

import { zoneNominalDemand } from '../city-response';
import { zoneCentroids } from '../layout';

/** Ambient at or below which heating load is the story. °C. */
const COLD_THRESHOLD_C = 12;
/** Radius of a district's heat disc, world units. */
const DISC_RADIUS = 38;
/** Peak opacity — an overlay, never a repaint of the city. */
const MAX_OPACITY = 0.34;
/** Seconds for the overlay to fade in or out. */
const FADE_SECONDS = 1.4;

/** Demand ÷ nominal at which the disc reaches full heat. */
const HOT_RATIO = 1.35;
/** Below this the district is running at or under profile. */
const COOL_RATIO = 0.95;

/** Cool end — a district carrying no unusual heating load. */
const COOL = new THREE.Color('#2F6C8F');
/** Hot end — a district well above its nominal profile. */
const HOT = new THREE.Color('#C4451F');

function ZoneHeat({
  zone,
  at,
  nominalMw,
}: {
  zone: string;
  at: readonly [number, number];
  nominalMw: number;
}): ReactElement {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const presence = useRef(0);
  const scratch = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    const node = mesh.current;
    const mat = material.current;
    if (node === null || mat === null) return;

    const state = useGridStore.getState();
    // Traceable cause: the overlay exists because the weather model says it is
    // cold, not because a scenario asked for a visual.
    const cold = state.temperatureC <= COLD_THRESHOLD_C;

    const target = cold ? 1 : 0;
    presence.current += (target - presence.current) * Math.min(1, delta / FADE_SECONDS);
    const p = presence.current;

    node.visible = p > 0.01;
    if (!node.visible) return;

    const status = state.zones.find((z) => (z.zone as string) === zone);
    const served = status === undefined ? 0 : (status.servedLoad as number);
    const unserved = status === undefined ? 0 : (status.unservedLoad as number);
    // Demand, not delivery: a district whose supply has been cut is still
    // asking for the heat, and that is what the operator needs to see.
    const ratio = nominalMw > 0 ? (served + unserved) / nominalMw : 0;

    const heat = Math.min(1, Math.max(0, (ratio - COOL_RATIO) / (HOT_RATIO - COOL_RATIO)));
    scratch.copy(COOL).lerp(HOT, heat);
    mat.color.copy(scratch);
    // Districts near their profile stay faint; the ones in trouble are the
    // ones that read from across the map.
    mat.opacity = p * MAX_OPACITY * (0.35 + 0.65 * heat);
  });

  return (
    <mesh
      ref={mesh}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[at[0], 0.28, at[1]]}
      visible={false}
    >
      <circleGeometry args={[DISC_RADIUS, 40]} />
      <meshBasicMaterial
        ref={material}
        color={COOL}
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Thermal demand overlay for every district. Mount once, inside the Canvas. */
export function DemandHeatmap(): ReactElement {
  const centroids = useMemo(zoneCentroids, []);
  const nominal = useMemo(zoneNominalDemand, []);

  return (
    <group name="demand-heatmap">
      {Object.entries(centroids).map(([zone, at]) => (
        <ZoneHeat key={zone} zone={zone} at={at} nominalMw={nominal[zone] ?? 0} />
      ))}
    </group>
  );
}
