/**
 * atmosphere.tsx — lightweight environmental life: drifting clouds, animated
 * harbor water, and district identity tints. Fully procedural (no textures),
 * no per-frame allocations, and every element supports comprehension — the
 * tints teach district boundaries, the water anchors the harbor narrative.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { ZONE_COLOR } from './layout';
import { zoneCentroid, zoneRadius } from './camera/shots';

// ---------------------------------------------------------------------------
// Drifting clouds — flat translucent discs high above the city
// ---------------------------------------------------------------------------

const CLOUDS: readonly { x: number; z: number; scale: number; speed: number }[] = [
  { x: -160, z: 60, scale: 34, speed: 1.6 },
  { x: -40, z: -140, scale: 26, speed: 1.1 },
  { x: 90, z: 130, scale: 40, speed: 1.3 },
  { x: 180, z: -60, scale: 30, speed: 1.8 },
  { x: 0, z: 40, scale: 22, speed: 0.9 },
];

function Clouds(): JSX.Element {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (group === null) return;
    for (let i = 0; i < group.children.length; i++) {
      const cloud = group.children[i];
      const spec = CLOUDS[i];
      if (cloud === undefined || spec === undefined) continue;
      cloud.position.x += delta * spec.speed;
      if (cloud.position.x > 320) cloud.position.x = -320;
    }
  });

  return (
    <group ref={groupRef}>
      {CLOUDS.map((cloud, index) => (
        <mesh
          key={index}
          position={[cloud.x, 150 + index * 7, cloud.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[cloud.scale, cloud.scale * 0.55, 1]}
        >
          <circleGeometry args={[1, 18]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Harbor water — animated shimmer anchoring the port district
// ---------------------------------------------------------------------------

function HarborWater(): JSX.Element {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current !== null) {
      materialRef.current.emissiveIntensity = 0.08 + Math.sin(clock.elapsedTime * 0.7) * 0.04;
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[92, -0.35, -70]}>
      <planeGeometry args={[120, 90]} />
      <meshStandardMaterial
        ref={materialRef}
        color="#5B84A0"
        emissive="#7FA6B8"
        emissiveIntensity={0.08}
        metalness={0.35}
        roughness={0.25}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// District identity tints — faint zone-colored ground washes
// ---------------------------------------------------------------------------

function DistrictTints(): JSX.Element {
  const zones = useMemo(
    () =>
      Object.keys(ZONE_COLOR).map((zoneId) => ({
        zoneId,
        centroid: zoneCentroid(zoneId),
        radius: zoneRadius(zoneId),
        color: ZONE_COLOR[zoneId] ?? '#888888',
      })),
    [],
  );

  return (
    <group>
      {zones.map((zone) => (
        <mesh
          key={zone.zoneId}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[zone.centroid[0], -0.2, zone.centroid[1]]}
        >
          <circleGeometry args={[zone.radius, 28]} />
          <meshBasicMaterial color={zone.color} transparent opacity={0.06} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Mount once in the Canvas. */
export function Atmosphere(): JSX.Element {
  return (
    <group name="atmosphere">
      <Clouds />
      <HarborWater />
      <DistrictTints />
    </group>
  );
}
