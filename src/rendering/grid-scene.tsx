/**
 * GridScene — renders the Meridian Bay electrical grid as a 3D top-down view.
 *
 * Components:
 *   BusMarkers  — spheres for each of the 20 buses, coloured by zone
 *   LineSegments — cylinders/tubes for each of the 30 transmission lines,
 *                  coloured by loading (green → yellow → red) or grey if open
 *   GeneratorMarkers — cones on generator buses, greyed-out if tripped
 *
 * All visual state comes from `useGridStore` — no simulation logic runs here.
 */
import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';
import { useGridStore } from '@state';
import { Text } from '@react-three/drei';

import { useMemo } from 'react';
import { BUS_POSITIONS, BUS_ZONE, ZONE_COLOR } from './layout';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Map a line loading [0..1+] to a hex colour. */
function loadingColor(loading: number, isOpen: boolean): string {
  if (isOpen) return '#374151'; // dark grey — open
  if (loading < 0.6) return '#22c55e';   // green — normal
  if (loading < 0.8) return '#eab308';   // yellow — caution
  if (loading < 1.0) return '#f97316';   // orange — high
  return '#ef4444';                       // red — overloaded
}

// ---------------------------------------------------------------------------
// BusMarkers
// ---------------------------------------------------------------------------
export function BusMarkers(): JSX.Element {
  const nodes = MERIDIAN_BAY_TOPOLOGY.nodes;

  return (
    <group name="buses">
      {nodes.map((node) => {
        const pos = BUS_POSITIONS[node.id];
        if (!pos) return null;
        const zone = BUS_ZONE[node.id] ?? 'DT';
        const color = ZONE_COLOR[zone] ?? '#ffffff';
        return (
          <group key={node.id} position={[pos[0], 0, pos[1]]}>
            <mesh>
              <sphereGeometry args={[2.5, 12, 12]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <Text
              position={[0, 4.5, 0]}
              fontSize={3}
              color="white"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.3}
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
// GeneratorMarkers
// ---------------------------------------------------------------------------
export function GeneratorMarkers(): JSX.Element {
  const generators = MERIDIAN_BAY_TOPOLOGY.generators;

  return (
    <group name="generators">
      {generators.map((gen) => {
        const pos = BUS_POSITIONS[gen.node];
        if (!pos) return null;
        // Simple heuristic: if the bus is islanded (all lines open) dim the generator
        const color = '#facc15'; // yellow — generator
        return (
          <group key={gen.id} position={[pos[0], 0, pos[1] - 5]}>
            <mesh rotation={[0, 0, Math.PI]}>
              <coneGeometry args={[2, 5, 8]} />
              <meshStandardMaterial color={color} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// LineSegments
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

  return (
    <group name="lines">
      {lines.map((line) => {
        const from = BUS_POSITIONS[line.from];
        const to = BUS_POSITIONS[line.to];
        if (!from || !to) return null;

        const loading = flowMap[line.id] ?? 0;
        const isOpen = openLines.has(line.id);
        const color = loadingColor(loading, isOpen);

        // Compute midpoint and rotation for the cylinder
        const fx = from[0], fz = from[1];
        const tx = to[0], tz = to[1];
        const mx = (fx + tx) / 2;
        const mz = (fz + tz) / 2;
        const dx = tx - fx, dz = tz - fz;
        const length = Math.sqrt(dx * dx + dz * dz);
        // Cylinder is along Y by default; rotate to lie along XZ plane
        const angle = Math.atan2(dx, dz);

        return (
          <group key={line.id} position={[mx, 0, mz]} rotation={[0, angle, 0]}>
            <mesh>
              <cylinderGeometry args={[isOpen ? 0.4 : 0.8, isOpen ? 0.4 : 0.8, length, 6]} />
              <meshStandardMaterial color={color} opacity={isOpen ? 0.35 : 1} transparent={isOpen} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ground plane
// ---------------------------------------------------------------------------
export function GroundPlane(): JSX.Element {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
      <planeGeometry args={[300, 300]} />
      <meshStandardMaterial color="#0f172a" />
    </mesh>
  );
}
