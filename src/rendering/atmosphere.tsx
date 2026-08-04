/**
 * atmosphere.tsx — environmental presentation layer: drifting clouds,
 * expansive organic curved coastline ocean water, shoreline terrain blending,
 * coastal rock outcrops, and shoreline vegetation.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
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
// Natural Coastal Ocean & Shoreline — organic curved shape & smooth terrain transition
// ---------------------------------------------------------------------------

function CoastalSea(): JSX.Element {
  const shallowRef = useRef<THREE.MeshStandardMaterial>(null);
  const deepRef = useRef<THREE.MeshStandardMaterial>(null);

  // Organic curved shoreline geometry
  const shorelineShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(85, -180);
    s.bezierCurveTo(110, -100, 95, -20, 105, 40);
    s.bezierCurveTo(115, 100, 90, 140, 110, 180);
    s.lineTo(300, 180);
    s.lineTo(300, -180);
    s.closePath();
    return s;
  }, []);

  const shallowShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(95, -180);
    s.bezierCurveTo(120, -100, 105, -20, 115, 40);
    s.bezierCurveTo(125, 100, 100, 140, 120, 180);
    s.lineTo(320, 180);
    s.lineTo(320, -180);
    s.closePath();
    return s;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (shallowRef.current !== null) {
      shallowRef.current.emissiveIntensity = 0.08 + Math.sin(t * 0.6) * 0.03;
    }
    if (deepRef.current !== null) {
      deepRef.current.emissiveIntensity = 0.04 + Math.cos(t * 0.4) * 0.02;
    }
  });

  return (
    <group name="coastal-sea">
      {/* 1. Sandy Beach dune shoreline shape */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.44, 0]}>
        <shapeGeometry args={[shorelineShape]} />
        <meshStandardMaterial color="#c2b280" roughness={0.9} transparent opacity={0.75} />
      </mesh>

      {/* 2. Shallow coastal aqua littoral zone with curved organic boundary */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, -0.36, 0]}>
        <shapeGeometry args={[shallowShape]} />
        <meshStandardMaterial
          ref={shallowRef}
          color="#0284c7"
          emissive="#38bdf8"
          emissiveIntensity={0.08}
          roughness={0.2}
          metalness={0.4}
          transparent
          opacity={0.84}
        />
      </mesh>

      {/* 3. Deep ocean basin core extending outward */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[160, -0.28, 0]}>
        <planeGeometry args={[260, 400]} />
        <meshStandardMaterial
          ref={deepRef}
          color="#0f172a"
          emissive="#1e3a8a"
          emissiveIntensity={0.04}
          metalness={0.75}
          roughness={0.12}
          transparent
          opacity={0.96}
        />
      </mesh>

      {/* 4. Coastal Rock Formations framing the shoreline curve */}
      {[
        { pos: [102, 1, 60] as const, scale: [4, 3, 5] as const },
        { pos: [108, 0.8, -40] as const, scale: [5, 2.5, 4] as const },
        { pos: [98, 1.2, -85] as const, scale: [3.5, 3.5, 4.5] as const },
        { pos: [115, 0.6, 110] as const, scale: [6, 2, 6] as const },
      ].map((rock, i) => (
        <mesh key={i} position={rock.pos} scale={rock.scale}>
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#475569" roughness={0.95} />
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
      <CoastalSea />
    </group>
  );
}
