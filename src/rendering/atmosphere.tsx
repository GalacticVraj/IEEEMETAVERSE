/**
 * atmosphere.tsx — environmental presentation layer: drifting clouds,
 * expansive organic curved coastline ocean water, shoreline terrain blending,
 * coastal rock outcrops, and shoreline vegetation.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';

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

/** Eastern edge of the ground terrain — where land ends and water begins. */
const SHORELINE_X = 90;
/** How far the water tucks under the shore so the seam cannot show a gap. */
const SHORE_OVERLAP = 6;
/**
 * The bay has to out-run the fog, not just the terrain. At 1600 x 1600 the
 * water's northern corner sat at z = -800, well inside the 1100-unit fog
 * distance — so from the hero camera you could see the sea END and green land
 * resume beyond it, as a hard diagonal across the top of the frame. Sized past
 * the fog plane, the water simply dissolves into the horizon.
 */
const SEA_WIDTH = 3400;
const SEA_DEPTH = 3400;
const SEA_CENTER_X = SHORELINE_X - SHORE_OVERLAP + SEA_WIDTH / 2;

function CoastalSea(): JSX.Element {
  return (
    <group name="coastal-sea">
      {/* Ocean plane meeting the eastern map boundary at X = +90.
          The plane deliberately OVERLAPS the shore by `SHORE_OVERLAP` and sits
          just under the terrain: butting the two edges together at exactly X=90
          left a hairline gap at grazing camera angles, since the terrain sits at
          y=-0.05 and the water at y=-0.15. It is also oversized in Z so the
          water reaches the fog line instead of ending in a visible straight
          edge inside the view. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[SEA_CENTER_X, -0.12, 0]}
        receiveShadow={false}
      >
        <planeGeometry args={[SEA_WIDTH, SEA_DEPTH]} />
        {/* OPAQUE and diffuse, both deliberately.
            `transparent` on a plane this large put the bay into the blended
            render pass, where it is depth-sorted against the shore shelf and
            the far terrain by object centre — and a 3,400-unit plane has a
            centre nowhere near the water you are actually looking at. The
            result was a hard-edged dark wedge across the bay that moved with
            the camera.
            The low roughness / high metalness was the other half: with no
            environment map there is nothing for a mirror-like surface to
            reflect, so under the dim crisis light the water fell to almost
            black instead of fogging into the horizon with everything else. */}
        <meshStandardMaterial
          color="#0E6E9B"
          emissive="#2E7FA8"
          emissiveIntensity={0.16}
          roughness={0.72}
          metalness={0.05}
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
