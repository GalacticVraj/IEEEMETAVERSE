/**
 * atmosphere.tsx — environmental presentation layer: drifting clouds,
 * expansive organic curved coastline ocean water, shoreline terrain blending,
 * coastal rock outcrops, and shoreline vegetation.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Drifting clouds — translucent organic layers high above the city
// ---------------------------------------------------------------------------

const CLOUDS: readonly { x: number; z: number; scale: number; speed: number }[] = [
  { x: -160, z: 60, scale: 42, speed: 1.4 },
  { x: -40, z: -140, scale: 32, speed: 1.1 },
  { x: 90, z: 130, scale: 48, speed: 1.2 },
  { x: 180, z: -60, scale: 38, speed: 1.6 },
  { x: 0, z: 40, scale: 28, speed: 0.9 },
  { x: -110, z: -80, scale: 35, speed: 1.3 },
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
      if (cloud.position.x > 340) cloud.position.x = -340;
    }
  });

  return (
    <group ref={groupRef}>
      {CLOUDS.map((cloud, index) => (
        <mesh
          key={index}
          position={[cloud.x, 150 + index * 6, cloud.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[cloud.scale, cloud.scale * 0.55, 1]}
        >
          <circleGeometry args={[1, 24]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.32} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rectangular Coastal Sea — clean straight coastline at map boundary X = +90
// ---------------------------------------------------------------------------

function CoastalSea(): JSX.Element {
  return (
    <group name="coastal-sea">
      {/* Rectangular ocean plane flush with the eastern map boundary (X = +90) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[240, -0.15, 0]}>
        <planeGeometry args={[300, 260]} />
        <meshStandardMaterial
          color="#0f172a"
          roughness={0.4}
          metalness={0.2}
          transparent
          opacity={0.98}
        />
      </mesh>
    </group>
  );
}

/** Mount once in the Canvas. */
export function Atmosphere(): JSX.Element {
  return (
    <group name="atmosphere">
      <Clouds />
      <CoastalSea />
    </group>
  );
}
