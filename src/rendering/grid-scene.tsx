/**
 * GridScene — renders the Meridian Bay electrical grid as a 3D top-down view.
 *
 * Upgraded with "Game-Level" Stylized Graphics.
 */
import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';
import { useGridStore, useUiStore } from '@state';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { BUS_POSITIONS, BUS_ZONE, ZONE_COLOR } from './layout';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function loadingColor(loading: number, isOpen: boolean): string {
  if (isOpen) return '#374151'; 
  if (loading < 0.6) return '#22c55e';   
  if (loading < 0.8) return '#eab308';   
  if (loading < 1.0) return '#f97316';   
  return '#ef4444';                      
}

function StylizedBuilding({ zone, color, pos }: { zone: string; color: string; pos: [number, number] }) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  useFrame(({ clock }) => {
    if (materialRef.current) {
      // Faint daylight accent shimmer — buildings must not glow like night
      materialRef.current.emissiveIntensity = 0.1 + Math.sin(clock.elapsedTime * 2 + pos[0]) * 0.04;
    }
  });

  // Daylight palette: light facades, zone color as a restrained accent glow.
  if (zone === 'DT') {
    return (
      <group position={[pos[0], 0, pos[1]]}>
        {/* Tall Skyscraper */}
        <mesh position={[0, 8, 0]} castShadow>
          <boxGeometry args={[4, 16, 4]} />
          <meshStandardMaterial ref={materialRef} color="#C6CDD4" emissive={color} emissiveIntensity={0.12} roughness={0.4} metalness={0.3} />
        </mesh>
      </group>
    );
  }
  if (zone === 'RES') {
    return (
      <group position={[pos[0], 0, pos[1]]}>
        {/* Apartment Cluster */}
        <mesh position={[-1.5, 4, -1.5]} castShadow>
          <boxGeometry args={[3, 8, 3]} />
          <meshStandardMaterial ref={materialRef} color="#D3D0C8" emissive={color} emissiveIntensity={0.1} />
        </mesh>
        <mesh position={[2, 3, 2]} castShadow>
          <boxGeometry args={[2.5, 6, 2.5]} />
          <meshStandardMaterial color="#CBC8C0" emissive={color} emissiveIntensity={0.1} />
        </mesh>
      </group>
    );
  }
  if (zone === 'IND') {
    return (
      <group position={[pos[0], 0, pos[1]]}>
        {/* Factory / Plant */}
        <mesh position={[0, 3, 0]} castShadow>
          <boxGeometry args={[8, 6, 6]} />
          <meshStandardMaterial color="#BEC4CB" emissive={color} emissiveIntensity={0.08} />
        </mesh>
        {/* Smoke stacks */}
        <mesh position={[-2, 8, 0]}>
          <cylinderGeometry args={[0.5, 0.8, 4, 8]} />
          <meshStandardMaterial color="#98A2AC" />
        </mesh>
        <mesh position={[2, 8, 0]}>
          <cylinderGeometry args={[0.5, 0.8, 4, 8]} />
          <meshStandardMaterial color="#98A2AC" />
        </mesh>
      </group>
    );
  }

  // Default (Substation/Other)
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[5, 4, 5]} />
        <meshStandardMaterial ref={materialRef} color="#5A6774" emissive={color} emissiveIntensity={0.25} wireframe />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// BusMarkers
// ---------------------------------------------------------------------------
export function BusMarkers(): JSX.Element {
  const nodes = MERIDIAN_BAY_TOPOLOGY.nodes;
  const selectAsset = useUiStore((s) => s.selectAsset);

  return (
    <group name="buses">
      {nodes.map((node) => {
        const pos = BUS_POSITIONS[node.id];
        if (!pos) return null;
        const zone = BUS_ZONE[node.id] ?? 'DT';
        const color = ZONE_COLOR[zone] ?? '#ffffff';
        return (
          <group
            key={node.id}
            onClick={(e) => {
              e.stopPropagation();
              selectAsset({ kind: 'bus', id: node.id as string });
            }}
          >
            <StylizedBuilding zone={zone} color={color} pos={pos} />
            <Text
              position={[pos[0], 18, pos[1]]}
              fontSize={2.5}
              color="white"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.2}
              outlineColor="#000000"
            >
              {node.id}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// GeneratorMarkers (Animated Turbines / Power Plants)
// ---------------------------------------------------------------------------
function AnimatedTurbine({ pos, isTripped, speed = 2 }: { pos: [number, number], isTripped: boolean, speed?: number }) {
  const bladesRef = useRef<THREE.Group>(null);
  const color = isTripped ? '#475569' : '#38bdf8'; // blue if active, gray if tripped

  useFrame((_, delta) => {
    if (bladesRef.current && !isTripped) {
      bladesRef.current.rotation.z -= delta * speed; // rotor follows real output
    }
  });

  return (
    <group position={[pos[0], 0, pos[1] - 8]}>
      {/* Tower */}
      <mesh position={[0, 6, 0]}>
        <cylinderGeometry args={[0.5, 1, 12, 8]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      {/* Engine room */}
      <mesh position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1, 1, 3, 8]} />
        <meshStandardMaterial color="#64748b" emissive={color} emissiveIntensity={0.5} />
      </mesh>
      {/* Blades */}
      <group ref={bladesRef} position={[0, 12, 1.6]}>
        <mesh position={[0, 4, 0]}>
          <boxGeometry args={[0.4, 8, 0.1]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <mesh position={[0, -4, 0]} rotation={[0, 0, Math.PI / 3]}>
           <boxGeometry args={[0.4, 8, 0.1]} />
           <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <mesh position={[0, -4, 0]} rotation={[0, 0, -Math.PI / 3]}>
           <boxGeometry args={[0.4, 8, 0.1]} />
           <meshStandardMaterial color="#94a3b8" />
        </mesh>
      </group>
    </group>
  );
}

export function GeneratorMarkers(): JSX.Element {
  const generators = MERIDIAN_BAY_TOPOLOGY.generators;
  const liveGenerators = useGridStore((s) => s.generators);
  const selectAsset = useUiStore((s) => s.selectAsset);

  return (
    <group name="generators">
      {generators.map((gen) => {
        const pos = BUS_POSITIONS[gen.node];
        if (!pos) return null;
        // REAL tripped state + output from the live projection — the rotor
        // stops when tripped and its speed follows actual utilization.
        const live = liveGenerators.find((g) => (g.id as string) === (gen.id as string));
        const utilization =
          live !== undefined && (gen.capacity as number) > 0
            ? (live.outputMw as number) / (gen.capacity as number)
            : 0.4;
        return (
          <group
            key={gen.id}
            onClick={(e) => {
              e.stopPropagation();
              selectAsset({ kind: 'generator', id: gen.id as string });
            }}
          >
            <AnimatedTurbine
              pos={pos}
              isTripped={live?.tripped ?? false}
              speed={0.5 + utilization * 3}
            />
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// LineSegments (Animated glowing flows)
// ---------------------------------------------------------------------------
export function TransmissionLines(): JSX.Element {
  const lines = MERIDIAN_BAY_TOPOLOGY.lines;
  const flows = useGridStore((s) => s.lines);
  const flowMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of flows) m[f.line] = f.loading;
    return m;
  }, [flows]);
  const openLines = useGridStore((s) => s.openLines);
  const selectAsset = useUiStore((s) => s.selectAsset);

  return (
    <group name="lines">
      {lines.map((line) => {
        const from = BUS_POSITIONS[line.from];
        const to = BUS_POSITIONS[line.to];
        if (!from || !to) return null;

        const loading = flowMap[line.id] ?? 0;
        const isOpen = openLines.has(line.id);
        const color = loadingColor(loading, isOpen);

        const fx = from[0], fz = from[1];
        const tx = to[0], tz = to[1];
        const mx = (fx + tx) / 2;
        const mz = (fz + tz) / 2;
        const dx = tx - fx, dz = tz - fz;
        const length = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dx, dz);

        return (
          <group
            key={line.id}
            position={[mx, 1.5, mz]}
            rotation={[0, angle, 0]}
            onClick={(e) => {
              e.stopPropagation();
              selectAsset({ kind: 'line', id: line.id as string });
            }}
          >
            {/* Base Wire — cylinder Y-axis laid flat along the corridor */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.6, 0.6, length, 6]} />
              <meshStandardMaterial color="#4A555F" transparent={isOpen} opacity={isOpen ? 0.2 : 0.9} />
            </mesh>
            {/* Status core — loading color, restrained emissive */}
            {!isOpen && (
              <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.2, 1, 1.2]}>
                <cylinderGeometry args={[0.4, 0.4, length, 6]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={loading * 0.9 + 0.2} transparent opacity={0.9} />
              </mesh>
            )}
            {/* Fault visual if tripped */}
            {isOpen && (
              <mesh rotation={[Math.PI / 2, 0, 0]} scale={[2, 1, 2]}>
                 <cylinderGeometry args={[1, 1, length, 4]} />
                 <meshStandardMaterial color="#B3261E" emissive="#B3261E" emissiveIntensity={0.8} wireframe />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ground plane (Nature-forward green terrain)
// ---------------------------------------------------------------------------
export function GroundPlane(): JSX.Element {
  return (
    <group>
      {/* Main terrain — daylight sage, receives building shadows */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#A9B4A4" roughness={0.95} metalness={0.0} />
      </mesh>
      {/* Subtle survey grid for scale readability */}
      <gridHelper args={[500, 50, '#93A08F', '#9DAA99']} position={[0, 0.02, 0]} />
    </group>
  );
}
