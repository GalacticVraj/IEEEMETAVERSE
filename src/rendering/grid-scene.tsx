/**
 * GridScene — renders the Meridian Bay electrical grid as a 3D top-down view.
 *
 * Upgraded with "Game-Level" Stylized Graphics, Real-time Power Flow Visualization,
 * Substation Infrastructure, and Dynamic Event Highlighting.
 * City-to-grid proportion strictly aligned (180x180 world grid footprint).
 */
import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';
import { useGridStore, useUiStore } from '@state';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { useMemo, useRef, useState } from 'react';
import { groundTexture } from './ground-texture';
import { BUS_POSITIONS, BUS_ZONE, ZONE_COLOR } from './layout';

// ---------------------------------------------------------------------------
// Line Loading Color Spectrum
// ---------------------------------------------------------------------------

/** Far terrain extent — must clear the furthest camera station in shots.ts. */
const FAR_TERRAIN_SIZE = 4000;
/** City terrain — sized to the built area; the only plane taking shadows. */
const CITY_TERRAIN_W = 220;
const CITY_TERRAIN_D = 260;
/** Where the land stops and the bay begins (mirrors atmosphere.tsx). */
const SHORE_X = 90;

/** Pulse travel speed (corridor lengths per second) at zero loading. */
const PULSE_BASE_SPEED = 0.4;
/** Additional pulse speed at full thermal loading. */
const PULSE_LOAD_GAIN = 1.8;

/**
 * Corridor loading → colour.
 *
 * The breakpoints are 60 / 80 / 100 % so the city agrees with the console:
 * GridHealthPanel tones corridor stress at exactly those numbers, and the
 * crisis ladder escalates on them. Before this they were 55 / 75 / 95, which
 * meant a corridor could be amber in the 3D view while the rail still called
 * it green — two instruments, one grid, two answers.
 *
 * Saturated hues rather than the console's muted palette on purpose: these are
 * read at distance, across a lit city, at a glance.
 */
function loadingColor(loading: number, isOpen: boolean): string {
  if (isOpen) return '#ef4444';
  if (loading < 0.6) return '#22c55e';
  if (loading < 0.8) return '#eab308';
  if (loading < 1.0) return '#f97316';
  return '#dc2626';
}

/** At or above this the corridor is past its thermal rating and pulses. */
const OVERLOAD_PU = 1.0;
/** Overload pulse rate, radians/second — an alarm cadence, not a shimmer. */
const OVERLOAD_PULSE_RATE = 6.5;

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
              selectAsset({ kind: 'bus', id: node.id });
            }}
          >
            <StylizedSubstationMarker zone={zone} color={color} pos={pos} />
            {/* The name chip lives in `bus-labels.tsx` now: as fixed-size world
                text it grew to dominate the frame whenever the camera closed
                in on an event. */}
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
      faultRingRef.current.emissiveIntensity = 0.5 + Math.sin(performance.now() * 0.008) * 0.5;
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
        <meshStandardMaterial
          color="#334155"
          emissive={color}
          emissiveIntensity={isTripped ? 0.9 : 0.4}
        />
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
              selectAsset({ kind: 'generator', id: gen.id });
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'auto';
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
  flowMw,
  isOpen,
  onClick,
}: {
  line: (typeof MERIDIAN_BAY_TOPOLOGY.lines)[number];
  loading: number;
  /** Signed: negative means power is flowing from `line.to` back toward `line.from`. */
  flowMw: number;
  isOpen: boolean;
  onClick: (e: { stopPropagation(): void }) => void;
}) {
  const from = BUS_POSITIONS[line.from];
  const to = BUS_POSITIONS[line.to];
  const pulseRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);
  // Phase is integrated rather than derived from elapsed time, so a change in
  // loading changes the pulse's SPEED instead of teleporting it: with
  // `(elapsedTime * speed) % 1` every loading update (10 Hz) jumped the phase.
  const phaseRef = useRef(0);

  const geometry = useMemo(() => {
    if (!from || !to) return null;
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    return {
      mx: (from[0] + to[0]) / 2,
      mz: (from[1] + to[1]) / 2,
      length: Math.sqrt(dx * dx + dz * dz),
      angle: Math.atan2(dx, dz),
    };
  }, [from, to]);

  // Pulses travel the corridor in the direction power is actually flowing. The
  // solver's flow is signed; the renderer used to drop the sign and animate
  // every corridor one way regardless, which misreports reversal during a
  // cascade — exactly the moment direction matters most.
  useFrame(({ clock }, delta) => {
    if (geometry === null || isOpen) return;

    const mesh = pulseRef.current;
    if (mesh !== null) {
      const direction = flowMw < 0 ? -1 : 1;
      const speed = PULSE_BASE_SPEED + loading * PULSE_LOAD_GAIN;
      phaseRef.current = (phaseRef.current + delta * speed * direction + 1) % 1;
      mesh.position.set(0, 0, (phaseRef.current - 0.5) * geometry.length);
    }

    // An overloaded corridor pulses. This is the one corridor state the
    // operator has seconds rather than minutes to answer, and a static red
    // does not distinguish "at its limit" from "past it".
    const glow = glowRef.current;
    if (glow !== null) {
      const base = loading * 0.85 + 0.25;
      const alarm =
        loading >= OVERLOAD_PU
          ? 0.55 + Math.sin(clock.elapsedTime * OVERLOAD_PULSE_RATE) * 0.45
          : 0;
      glow.emissiveIntensity = base + alarm + (hovered ? 0.6 : 0);
    }
  });

  if (geometry === null) return null;

  const color = loadingColor(loading, isOpen);
  const { mx, mz, length, angle } = geometry;

  return (
    <group
      position={[mx, 1.8, mz]}
      rotation={[0, angle, 0]}
      onClick={onClick}
      // Hover is what tells the player a corridor is a THING you can ask
      // about. Without it the lines read as scenery and the detail panel
      // behind them is never discovered.
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, length, 6]} />
        <meshStandardMaterial
          color={hovered ? '#64748b' : '#334155'}
          transparent={isOpen}
          opacity={isOpen ? 0.25 : 0.9}
        />
      </mesh>

      {!isOpen && (
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={hovered ? [1.75, 1, 1.75] : [1.15, 1, 1.15]}>
          <cylinderGeometry args={[0.38, 0.38, length, 6]} />
          <meshStandardMaterial
            ref={glowRef}
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
          <meshStandardMaterial
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={0.9}
            wireframe
          />
        </mesh>
      )}
    </group>
  );
}

export function TransmissionLines(): JSX.Element {
  const lines = MERIDIAN_BAY_TOPOLOGY.lines;
  const flows = useGridStore((s) => s.lines);
  const flowMap = useMemo(() => {
    const m: Record<string, { loading: number; flowMw: number }> = {};
    for (const f of flows) m[f.line] = { loading: f.loading, flowMw: f.flow };
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
          loading={flowMap[line.id]?.loading ?? 0}
          flowMw={flowMap[line.id]?.flowMw ?? 0}
          isOpen={openLines.has(line.id)}
          onClick={(e) => {
            e.stopPropagation();
            selectAsset({ kind: 'line', id: line.id });
          }}
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ground: one continuous lit surface, no slab, no unlit grid
// ---------------------------------------------------------------------------

/**
 * Distant ridge line, ringing the landward side of the bay.
 *
 * Three lone cones read as three cones; a run of overlapping ones at varied
 * scale reads as terrain. Deterministic — the numbers are a fixed table, never
 * `Math.random()`, so every run and every replay frames the same horizon.
 *
 * The distances matter as much as the shapes. Placed near the city these are
 * unmistakably cones sitting in frame; placed out at 750–1050 units they fall
 * deep into the fog and become a soft ridge behind the skyline. Fog does most
 * of the work here — the geometry is only a silhouette.
 *
 * The eastern arc is deliberately empty: that is the open bay.
 */
const RIDGE: readonly { x: number; z: number; r: number; h: number; rot: number }[] = [
  { x: -980, z: -180, r: 260, h: 122, rot: 0.4 },
  { x: -820, z: -520, r: 230, h: 98, rot: 1.1 },
  { x: -500, z: -800, r: 285, h: 132, rot: 2.0 },
  { x: -160, z: -900, r: 240, h: 104, rot: 0.7 },
  { x: 200, z: -880, r: 205, h: 86, rot: 1.7 },
  { x: 520, z: -770, r: 185, h: 74, rot: 2.6 },
  { x: -1010, z: 260, r: 245, h: 106, rot: 0.2 },
  { x: -880, z: 560, r: 215, h: 88, rot: 1.4 },
  { x: -560, z: 820, r: 250, h: 112, rot: 2.2 },
  { x: -200, z: 900, r: 200, h: 82, rot: 0.9 },
];

function Ridge(): JSX.Element {
  return (
    <group name="ridge">
      {RIDGE.map((peak, index) => (
        <mesh key={index} position={[peak.x, peak.h / 2 - 6, peak.z]} rotation={[0, peak.rot, 0]}>
          <coneGeometry args={[peak.r, peak.h, 6]} />
          <meshStandardMaterial
            color={index % 2 === 0 ? '#263B31' : '#2B4237'}
            roughness={1}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Where the land meets the water. The sea plane used to butt straight into the
 * terrain, producing a razor diagonal with no shore at all. A sand band and a
 * paler shallow shelf give the coast somewhere to happen.
 */
function Shoreline(): JSX.Element {
  return (
    <group name="shoreline">
      {/* Beach: a narrow warm band right at the waterline. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[SHORE_X - 2.5, 0.02, 0]} receiveShadow>
        <planeGeometry args={[6, CITY_TERRAIN_D + 40]} />
        <meshStandardMaterial color="#4E5747" roughness={1} />
      </mesh>

      {/* Shallow shelf: lighter water hugging the beach, so the sea reads as
          having a depth gradient rather than being one flat blue sheet. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[SHORE_X + 16, -0.09, 0]}>
        <planeGeometry args={[36, CITY_TERRAIN_D + 80]} />
        <meshStandardMaterial
          color="#2E8FB8"
          roughness={0.35}
          metalness={0.15}
          transparent
          opacity={0.72}
        />
      </mesh>
    </group>
  );
}

export function GroundPlane(): JSX.Element {
  // Null under jsdom (no canvas 2D context); the plane then falls back to a
  // flat colour, which is exactly the pre-texture behaviour.
  const surface = useMemo(() => groundTexture(), []);

  return (
    <group name="ground-terrain">
      {/* Far terrain, out to the fog line. Now the SAME tone as the city
          ground: the two planes used to be different colours at different
          heights, which is what made the built area read as a slab lying on
          top of the world. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.75, 0]}>
        <planeGeometry args={[FAR_TERRAIN_SIZE, FAR_TERRAIN_SIZE]} />
        <meshStandardMaterial color="#2C4438" roughness={1} metalness={0} />
      </mesh>

      {/* City ground. Carries the survey grid as part of its MAP, so the grid
          is LIT — it dims into the night with the buildings standing on it,
          instead of glowing at full daylight brightness after dark the way the
          old `gridHelper` did. The map also fades out at three of its edges,
          which is what dissolves the slab. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-20, -0.05, 0]} receiveShadow>
        <planeGeometry args={[CITY_TERRAIN_W, CITY_TERRAIN_D]} />
        {surface === null ? (
          <meshStandardMaterial color="#35513F" roughness={0.92} metalness={0} />
        ) : (
          <meshStandardMaterial
            map={surface}
            transparent
            roughness={0.92}
            metalness={0}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        )}
      </mesh>

      <Shoreline />
      <Ridge />
    </group>
  );
}
