/**
 * bus-labels.tsx — substation name chips, anchored in the world.
 *
 * Replaces the bare `<Text fontSize={2.6}>` that used to float over every bus.
 * That text was sized in WORLD units and always on, so its size on screen was
 * whatever the camera happened to be doing: the moment auto-follow pushed in on
 * an event, "HB1" and "IN3" became the largest objects in the frame and the
 * scene read as a debug view with labels bolted on.
 *
 * Two rules fix it, and they are the two the brief asks for:
 *   - constant apparent size, by scaling with camera distance
 *   - fade out at far zoom, so the wide establishing shots show a CITY rather
 *     than a wall of identifiers
 *
 * A tinted dot carries the district colour, so the chip identifies a zone at a
 * glance without spelling it out. Presentation only: positions come from the
 * static topology table and nothing here reads or writes simulation state.
 */
import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';

import { BUS_POSITIONS, BUS_ZONE, ZONE_COLOR } from './layout';

/**
 * Scale per world-unit of camera distance. Tuned so the label holds ~13px at a
 * 900px-tall viewport with the scene's 45° vertical FOV.
 */
const SCREEN_SCALE = 0.0038;
/**
 * The floor matters more than it looks. Set too high, a chip the camera has
 * closed right in on stops shrinking and becomes the biggest thing in frame —
 * the exact failure the world-space text had, reintroduced by a clamp.
 */
const MIN_SCALE = 0.3;
const MAX_SCALE = 1.6;

/** Fully legible closer than this, gone beyond FADE_END. */
const FADE_START = 300;
const FADE_END = 560;

/** How far above the substation the chip floats. */
const LIFT = 19;

/** Reused every frame — the render path allocates nothing. */
const scratch = new THREE.Vector3();

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

function BusLabel({
  id,
  position,
  color,
}: {
  id: string;
  position: readonly [number, number];
  color: string;
}): ReactElement {
  const group = useRef<THREE.Group>(null);
  const plate = useRef<THREE.MeshBasicMaterial>(null);
  const dot = useRef<THREE.MeshBasicMaterial>(null);
  const label = useRef<THREE.Mesh>(null);

  useFrame(({ camera }) => {
    const node = group.current;
    if (node === null) return;

    const distance = camera.position.distanceTo(node.getWorldPosition(scratch));

    // Constant apparent size.
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, distance * SCREEN_SCALE));
    node.scale.setScalar(scale);

    // Fade out on the wide shots.
    const opacity = 1 - smoothstep(FADE_START, FADE_END, distance);
    node.visible = opacity > 0.02;
    if (!node.visible) return;

    if (plate.current !== null) plate.current.opacity = opacity * 0.82;
    if (dot.current !== null) dot.current.opacity = opacity;
    const text = label.current;
    if (text !== null) {
      const { material } = text;
      if (!Array.isArray(material)) material.opacity = opacity;
    }
  });

  return (
    <Billboard ref={group} position={[position[0], LIFT, position[1]]}>
      {/* Chip backing — a plate, not a glow. Keeps the name legible over both
          the pale afternoon sky and the dark night ground. */}
      <mesh renderOrder={2}>
        <planeGeometry args={[6.8, 2.7]} />
        <meshBasicMaterial
          ref={plate}
          color="#0F1720"
          transparent
          opacity={0.82}
          depthWrite={false}
        />
      </mesh>

      {/* District colour, so the chip says WHERE as well as WHAT. */}
      <mesh position={[-2.35, 0, 0.01]} renderOrder={3}>
        <circleGeometry args={[0.58, 12]} />
        <meshBasicMaterial ref={dot} color={color} transparent depthWrite={false} />
      </mesh>

      <Text
        ref={label}
        position={[0.45, 0, 0.02]}
        fontSize={1.42}
        color="#F2F5F3"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.06}
        renderOrder={4}
        material-transparent
        material-depthWrite={false}
      >
        {id}
      </Text>
    </Billboard>
  );
}

/** Every substation chip. Mount once, inside the Canvas. */
export function BusLabels(): ReactElement {
  const labels = useMemo(
    () =>
      Object.entries(BUS_POSITIONS).map(([id, position]) => ({
        id,
        position,
        color: ZONE_COLOR[BUS_ZONE[id] ?? 'DT'] ?? '#FFFFFF',
      })),
    [],
  );

  return (
    <group name="bus-labels">
      {labels.map((entry) => (
        <BusLabel key={entry.id} id={entry.id} position={entry.position} color={entry.color} />
      ))}
    </group>
  );
}
