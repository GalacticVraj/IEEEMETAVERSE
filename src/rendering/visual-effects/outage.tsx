/**
 * outage.tsx — a district losing power, drawn where the district is.
 *
 * Three things happen when a zone goes to `Blackout`, and none of them is on a
 * timer: a haze settles over the district, a dark footprint marks its extent
 * on the ground, and its name rises off the map once and fades. The buildings
 * themselves already dim — that is `DimGroup` in `city-layout` — so this adds
 * the part the buildings cannot: legibility from the wide shot, where a
 * district that has merely stopped glowing is easy to miss against a daylight
 * city.
 *
 * All of it is driven by `ZoneStatus.state`, straight off the engine's own
 * projection. Nothing here computes simulation state and nothing spawns
 * without a real transition behind it.
 *
 * Every zone's marker is MOUNTED for the whole run and animates its own
 * opacity toward a target. Mounting and unmounting on the transition instead
 * would pop the haze in and out, and would rebuild geometry during a cascade —
 * the worst possible moment to allocate.
 */
import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useGridStore } from '@state';
import { useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';

import { zoneDisplayName } from '../../ui/console/learning-copy';
import { zoneCentroids } from '../layout';

/** Radius of the haze dome and ground footprint, world units. */
const FOOTPRINT_RADIUS = 42;
/** Peak opacity of the haze. Restrained: this is smoke, not a black dome. */
const HAZE_OPACITY = 0.3;
/** Peak opacity of the ground footprint. */
const FOOTPRINT_OPACITY = 0.42;
/** Seconds for the haze to settle in or clear out. */
const FADE_SECONDS = 1.1;
/** How long the name floats before it is gone, seconds. */
const LABEL_LIFE = 3.4;
/** How far the name rises over its life, world units. */
const LABEL_RISE = 16;
/** Resting height of the name above the district. */
const LABEL_BASE_Y = 30;

/** De-energized slate — the frozen palette's `status.offline`, darkened. */
const HAZE_COLOR = '#141C24';
/** `status.critical`, for the footprint edge. */
const EDGE_COLOR = '#B3261E';

const smoothstep = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

function ZoneOutage({ zone, at }: { zone: string; at: readonly [number, number] }): ReactElement {
  const hazeRef = useRef<THREE.Mesh>(null);
  const hazeMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const footRef = useRef<THREE.Mesh>(null);
  const footMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const edgeMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const labelGroup = useRef<THREE.Group>(null);
  const labelMesh = useRef<THREE.Mesh>(null);

  /** 0 = powered, 1 = fully settled darkness. */
  const presence = useRef(0);
  const wasDark = useRef(false);
  /** Seconds since the district went dark; >= LABEL_LIFE means no label. */
  const labelAge = useRef(LABEL_LIFE);

  useFrame((_, delta) => {
    // Read straight from the store rather than subscribing: this runs in the
    // frame loop either way, and a per-tick subscription here would re-render
    // six components ten times a second for a boolean that rarely changes.
    const zones = useGridStore.getState().zones;
    const status = zones.find((z) => (z.zone as string) === zone);
    const dark = status?.state === 'Blackout';

    // The name is a one-shot on the DOWN transition only. Restoration gets its
    // own language elsewhere (the buildings simply come back on).
    if (dark && !wasDark.current) labelAge.current = 0;
    wasDark.current = dark;

    const target = dark ? 1 : 0;
    const step = Math.min(1, delta / FADE_SECONDS);
    presence.current += (target - presence.current) * step;
    const p = presence.current;

    const visible = p > 0.01;
    const haze = hazeRef.current;
    const foot = footRef.current;
    if (haze !== null) haze.visible = visible;
    if (foot !== null) foot.visible = visible;

    if (visible) {
      if (hazeMaterial.current !== null) hazeMaterial.current.opacity = p * HAZE_OPACITY;
      if (footMaterial.current !== null) footMaterial.current.opacity = p * FOOTPRINT_OPACITY;
      if (edgeMaterial.current !== null) edgeMaterial.current.opacity = p * 0.85;
    }

    // ── the rising name ──
    const group = labelGroup.current;
    if (group === null) return;

    if (labelAge.current >= LABEL_LIFE) {
      if (group.visible) group.visible = false;
      return;
    }

    labelAge.current += delta;
    const t = Math.min(1, labelAge.current / LABEL_LIFE);
    group.visible = true;
    group.position.set(at[0], LABEL_BASE_Y + smoothstep(t) * LABEL_RISE, at[1]);

    // In fast, hold, then out — a caption, not a crossfade.
    const opacity = t < 0.12 ? t / 0.12 : t > 0.68 ? 1 - (t - 0.68) / 0.32 : 1;
    const text = labelMesh.current;
    if (text !== null && !Array.isArray(text.material)) {
      text.material.opacity = Math.max(0, opacity);
    }
  });

  return (
    <group name={`outage-${zone}`}>
      {/* Haze over the district. `depthWrite={false}` keeps it from punching a
          hole in everything drawn after it; the sphere is small enough that
          the transparency-sorting trap the big sea plane fell into does not
          apply here. */}
      <mesh ref={hazeRef} position={[at[0], 14, at[1]]} visible={false}>
        <sphereGeometry args={[FOOTPRINT_RADIUS, 20, 14]} />
        <meshBasicMaterial
          ref={hazeMaterial}
          color={HAZE_COLOR}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.FrontSide}
          toneMapped={false}
        />
      </mesh>

      {/* Ground footprint: the outage has an EXTENT, and from the wide
          establishing shot this is what makes it read as a region rather than
          a few unlit rooftops. */}
      <mesh
        ref={footRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[at[0], 0.35, at[1]]}
        visible={false}
      >
        <circleGeometry args={[FOOTPRINT_RADIUS, 40]} />
        <meshBasicMaterial
          ref={footMaterial}
          color={HAZE_COLOR}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Edge, in the critical red. The footprint alone is just a shadow. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[at[0], 0.4, at[1]]}>
        <ringGeometry args={[FOOTPRINT_RADIUS - 1.1, FOOTPRINT_RADIUS, 48]} />
        <meshBasicMaterial
          ref={edgeMaterial}
          color={EDGE_COLOR}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <Billboard ref={labelGroup} visible={false}>
        <Text
          ref={labelMesh}
          fontSize={5.4}
          color="#F1544B"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.1}
          outlineWidth={0.24}
          outlineColor="#0B1218"
          material-transparent
          material-depthWrite={false}
          material-toneMapped={false}
        >
          {`BLACKOUT — ${zoneDisplayName(zone)}`}
        </Text>
      </Billboard>
    </group>
  );
}

/**
 * Outage markers for every district. Mount once, inside the Canvas.
 *
 * The zone list comes from the static centroid table rather than from the live
 * projection, so the components are stable for the whole run and a blackout
 * never mounts geometry mid-cascade.
 */
export function OutageMarkers(): ReactElement {
  const centroids = useMemo(zoneCentroids, []);

  return (
    <group name="outage-markers">
      {Object.entries(centroids).map(([zone, at]) => (
        <ZoneOutage key={zone} zone={zone} at={at} />
      ))}
    </group>
  );
}
