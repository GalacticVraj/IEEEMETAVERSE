/**
 * GridScene — renders the Meridian Bay electrical grid as a 3D top-down view.
 *
 * Upgraded with "Game-Level" Stylized Graphics, Real-time Power Flow Visualization,
 * Substation Infrastructure, and Dynamic Event Highlighting.
 * City-to-grid proportion strictly aligned (180x180 world grid footprint).
 */
import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';
import { useGridStore, useUiStore } from '@state';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { BUS_POSITIONS, BUS_ZONE, ZONE_COLOR } from './layout';

// ---------------------------------------------------------------------------
// Line Loading Color Spectrum
// ---------------------------------------------------------------------------

function loadingColor(loading: number, isOpen: boolean): string {
  if (isOpen) return '#ef4444';
  if (loading < 0.55) return '#22c55e';
  if (loading < 0.75) return '#eab308';
  if (loading < 0.95) return '#f97316';
  return '#dc2626';
}

function StylizedSubstationMarker({
  zone,
  color,
  pos,
}: {
  zone: string;
  color: string;
  pos: [number, number];
}) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.emissiveIntensity =
        0.15 + Math.sin(clock.elapsedTime * 2 + pos[0]) * 0.05;
    }
  });

  if (zone === 'DT') {
    return (
      <group position={[pos[0], 0, pos[1]]}>
        <mesh position={[0, 9, 0]} castShadow>
          <boxGeometry args={[4.5, 18, 4.5]} />
          <meshStandardMaterial
            ref={materialRef}
            color="#94a3b8"
            emissive={color}
            emissiveIntensity={0.15}
            roughness={0.3}
            metalness={0.4}
          />
        </mesh>
      </group>
    );
  }
  if (zone === 'RN' || zone === 'RS') {
    return (
      <group position={[pos[0], 0, pos[1]]}>
        <mesh position={[-1.8, 4.5, -1.8]} castShadow>
          <boxGeometry args={[3.2, 9, 3.2]} />
          <meshStandardMaterial
            ref={materialRef}
            color="#cbd5e1"
            emissive={color}
            emissiveIntensity={0.12}
          />
        </mesh>
        <mesh position={[2, 3.5, 2]} castShadow>
          <boxGeometry args={[2.8, 7, 2.8]} />
          <meshStandardMaterial color="#94a3b8" emissive={color} emissiveIntensity={0.12} />
        </mesh>
      </group>
    );
  }
  if (zone === 'IN') {
    return (
      <group position={[pos[0], 0, pos[1]]}>
        <mesh position={[0, 3.5, 0]} castShadow>
          <boxGeometry args={[8.5, 7, 6.5]} />
          <meshStandardMaterial color="#475569" emissive={color} emissiveIntensity={0.1} />
        </mesh>
        <mesh position={[-2.2, 8.5, 0]}>
          <cylinderGeometry args={[0.5, 0.85, 4.5, 8]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
        <mesh position={[2.2, 8.5, 0]}>
          <cylinderGeometry args={[0.5, 0.85, 4.5, 8]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[pos[0], 0, pos[1]]}>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[5.5, 5, 5.5]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#334155"
          emissive={color}
          emissiveIntensity={0.3}
          wireframe
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// BusMarkers — Electrical Network Substation Nodes
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
            <StylizedSubstationMarker zone={zone} color={color} pos={pos} />
            <Text
              position={[pos[0], 20, pos[1]]}
              fontSize={2.6}
              color="white"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.25}
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
// GeneratorMarkers (Animated Turbines + Trip Fault Pulse)
// ---------------------------------------------------------------------------
function AnimatedTurbine({
  pos,
  isTripped,
  speed = 2,
}: {
  pos: [number, number];
  isTripped: boolean;
  speed?: number;
}) {
  const bladesRef = useRef<THREE.Group>(null);
  const faultRingRef = useRef<THREE.MeshStandardMaterial>(null);
  const color = isTripped ? '#ef4444' : '#38bdf8';

  useFrame((_, delta) => {
    if (bladesRef.current && !isTripped) {
      bladesRef.current.rotation.z -= delta * speed;
    }
    if (faultRingRef.current && isTripped) {
      faultRingRef.current.emissiveIntensity =
        0.5 + Math.sin(performance.now() * 0.008) * 0.5;
    }
  });

  return (
    <group position={[pos[0], 0, pos[1] - 9]}>
      <mesh position={[0, 7, 0]}>
        <cylinderGeometry args={[0.55, 1.1, 14, 8]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh position={[0, 14, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.1, 1.1, 3.5, 8]} />
        <meshStandardMaterial color="#334155" emissive={color} emissiveIntensity={isTripped ? 0.9 : 0.4} />
      </mesh>
      <group ref={bladesRef} position={[0, 14, 1.8]}>
        <mesh position={[0, 4.5, 0]}>
          <boxGeometry args={[0.45, 9, 0.1]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
        <mesh position={[0, -4.5, 0]} rotation={[0, 0, Math.PI / 3]}>
          <boxGeometry args={[0.45, 9, 0.1]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
        <mesh position={[0, -4.5, 0]} rotation={[0, 0, -Math.PI / 3]}>
          <boxGeometry args={[0.45, 9, 0.1]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
      </group>

      {isTripped && (
        <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.5, 7.5, 24]} />
          <meshStandardMaterial
            ref={faultRingRef}
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={1.0}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}
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
        const live = liveGenerators.find((g) => (g.id as string) === (gen.id as string));
        const utilization =
          live !== undefined && (gen.capacity as number) > 0
            ? (live.outputMw as number) / (gen.capacity as number)
            : 0.45;
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
              speed={0.6 + utilization * 3.2}
            />
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Transmission Corridor with Animated Power Flow Particle
// ---------------------------------------------------------------------------
function AnimatedLineCorridor({
  line,
  loading,
  isOpen,
  onClick,
}: {
  line: (typeof MERIDIAN_BAY_TOPOLOGY.lines)[number];
  loading: number;
  isOpen: boolean;
  onClick: (e: { stopPropagation(): void }) => void;
}) {
  const from = BUS_POSITIONS[line.from];
  const to = BUS_POSITIONS[line.to];
  const pulseRef = useRef<THREE.Mesh>(null);

  if (!from || !to) return null;

  const color = loadingColor(loading, isOpen);
  const fx = from[0],
    fz = from[1];
  const tx = to[0],
    tz = to[1];
  const mx = (fx + tx) / 2;
  const mz = (fz + tz) / 2;
  const dx = tx - fx,
    dz = tz - fz;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);

  // Path A: Power flow pulses move horizontally along line corridors (z-axis) as live renewable/load flow indicators.
  useFrame(({ clock }) => {
    if (pulseRef.current && !isOpen) {
      const speed = 0.4 + loading * 1.8;
      const progress = (clock.elapsedTime * speed) % 1;
      const offset = (progress - 0.5) * length;
      pulseRef.current.position.set(0, 0, offset);
    }
  });

  return (
    <group position={[mx, 1.8, mz]} rotation={[0, angle, 0]} onClick={onClick}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, length, 6]} />
        <meshStandardMaterial color="#334155" transparent={isOpen} opacity={isOpen ? 0.25 : 0.9} />
      </mesh>

      {!isOpen && (
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.15, 1, 1.15]}>
          <cylinderGeometry args={[0.38, 0.38, length, 6]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={loading * 0.85 + 0.25}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}

      {!isOpen && (
        <mesh ref={pulseRef} rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[1.15, 10, 10]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.3}
            transparent
            opacity={0.88}
          />
        </mesh>
      )}

      {isOpen && (
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[2, 1, 2]}>
          <cylinderGeometry args={[1, 1, length, 4]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.9} wireframe />
        </mesh>
      )}
    </group>
  );
}

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
      {lines.map((line) => (
        <AnimatedLineCorridor
          key={line.id}
          line={line}
          loading={flowMap[line.id] ?? 0}
          isOpen={openLines.has(line.id)}
          onClick={(e) => {
            e.stopPropagation();
            selectAsset({ kind: 'line', id: line.id as string });
          }}
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ground plane (Tightly scaled 180x180 grid framing the city footprint)
// ---------------------------------------------------------------------------
export function GroundPlane(): JSX.Element {
  return (
    <group name="ground-terrain">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-20, -0.05, 0]} receiveShadow>
        <planeGeometry args={[220, 260]} />
        <meshStandardMaterial color="#2d4a3e" roughness={0.92} metalness={0.0} />
      </mesh>
      {/* Tightly-proportioned 180x180 grid helper */}
      <gridHelper args={[180, 18, '#15803d', '#1e3a2b']} position={[0, 0.02, 0]} />

      {/* Mountain Framing Ridges along North & West */}
      <group position={[-110, 0, -110]}>
        <mesh position={[0, 22, 0]}>
          <coneGeometry args={[45, 40, 7]} />
          <meshStandardMaterial color="#1e3a2b" roughness={0.9} />
        </mesh>
        <mesh position={[50, 16, -20]}>
          <coneGeometry args={[38, 30, 7]} />
          <meshStandardMaterial color="#166534" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}
