/**
 * zone-labels.tsx — district name plates, and the district as a clickable thing.
 *
 * The city had substation chips ("HB1", "RN2") and building names, but nothing
 * that said *Harbor District*. That is the altitude the operator actually
 * thinks and acts at — you shed Residential North, you do not shed bus RN2 —
 * so the district needed a name in the world and a way to be selected.
 *
 * Deliberately the INVERSE of `bus-labels`: those fade IN as the camera closes
 * on a substation, these fade OUT. Wide establishing shots get district names
 * and orientation; close inspection gets equipment identifiers. Both on at
 * once would be the wall of text the bus labels were rescued from.
 *
 * Presentation only. Positions come from the static centroid table, status
 * comes from the `ZoneStatus` projection, and nothing here computes or mutates
 * simulation state.
 */
import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useGridStore, useUiStore } from '@state';
import { useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';

import { zoneDisplayName } from '../ui/console/learning-copy';

import { zoneCentroids } from './layout';

/** Scale per world-unit of camera distance — matches the bus chips' feel. */
const SCREEN_SCALE = 0.0052;
const MIN_SCALE = 0.55;
const MAX_SCALE = 2.6;

/**
 * Gone by NEAR, fully legible past FAR — the opposite way round to bus chips.
 *
 * The band is set against the camera's actual working pose, not by eye:
 * `OPERATOR_HOME` sits at [10, 155, 215], which puts the district centroids
 * roughly 185–290 units away. A band of 240→400 (the first guess) would have
 * left the plates invisible or half-faded at the ONE view the operator spends
 * the whole shift in. At 120→190 they are solid at home and gone by the time a
 * focus shot has closed in on a single asset.
 */
const NEAR = 120;
const FAR = 190;

/** How far above the district the plate floats — clear of the tallest tower. */
const LIFT = 46;

/** Ground ring radius drawn under the selected district. */
const SELECTION_RADIUS = 40;

const STATUS_COLOR = {
  powered: '#3FD69A',
  degraded: '#E8A33D',
  dark: '#F1544B',
} as const;

/** Reused every frame — the render path allocates nothing. */
const scratch = new THREE.Vector3();

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

function ZoneLabel({ zone, at }: { zone: string; at: readonly [number, number] }): ReactElement {
  const group = useRef<THREE.Group>(null);
  const plate = useRef<THREE.MeshBasicMaterial>(null);
  const dot = useRef<THREE.MeshBasicMaterial>(null);
  const label = useRef<THREE.Mesh>(null);
  const ringGroup = useRef<THREE.Group>(null);
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);

  const selectAsset = useUiStore((s) => s.selectAsset);
  const name = useMemo(() => zoneDisplayName(zone).toUpperCase(), [zone]);

  useFrame(({ camera, clock }) => {
    const node = group.current;
    if (node === null) return;

    const distance = camera.position.distanceTo(node.getWorldPosition(scratch));

    // Constant apparent size.
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, distance * SCREEN_SCALE));
    node.scale.setScalar(scale);

    // Fade IN with distance — visible on the wide shot, out of the way close up.
    const opacity = smoothstep(NEAR, FAR, distance);
    node.visible = opacity > 0.02;

    // Read status straight from the store in the frame loop: subscribing would
    // re-render six labels on all ten ticks a second for a value that changes
    // a handful of times a run.
    const state = useGridStore.getState();
    const status = state.zones.find((z) => (z.zone as string) === zone);
    const tone =
      status?.state === 'Blackout'
        ? STATUS_COLOR.dark
        : status?.state === 'Degraded'
          ? STATUS_COLOR.degraded
          : STATUS_COLOR.powered;

    if (node.visible) {
      if (plate.current !== null) plate.current.opacity = opacity * 0.84;
      if (dot.current !== null) {
        dot.current.opacity = opacity;
        dot.current.color.set(tone);
      }
      const text = label.current;
      if (text !== null && !Array.isArray(text.material)) text.material.opacity = opacity;
    }

    // Selection ring, on the ground where the district is.
    const ring = ringGroup.current;
    if (ring === null) return;
    const selected = useUiStore.getState().selectedAsset;
    const isSelected = selected?.kind === 'zone' && selected.id === zone;
    ring.visible = isSelected;
    if (isSelected && ringMaterial.current !== null) {
      // A slow breath, so the ring reads as "this is the one you picked"
      // rather than as another alarm competing with the corridors.
      ringMaterial.current.opacity = 0.55 + Math.sin(clock.elapsedTime * 2.2) * 0.2;
      ringMaterial.current.color.set(tone);
    }
  });

  const select = (e: { stopPropagation(): void }): void => {
    e.stopPropagation();
    selectAsset({ kind: 'zone', id: zone });
  };

  return (
    <group>
      <Billboard ref={group} position={[at[0], LIFT, at[1]]}>
        <mesh
          renderOrder={2}
          onClick={select}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'auto';
          }}
        >
          <planeGeometry args={[name.length * 1.15 + 5, 3.6]} />
          <meshBasicMaterial
            ref={plate}
            color="#0F1720"
            transparent
            opacity={0.84}
            depthWrite={false}
          />
        </mesh>

        {/* District status, so the plate says how the district IS as well as
            what it is called. */}
        <mesh position={[-(name.length * 1.15 + 5) / 2 + 1.5, 0, 0.01]} renderOrder={3}>
          <circleGeometry args={[0.72, 12]} />
          <meshBasicMaterial
            ref={dot}
            color={STATUS_COLOR.powered}
            transparent
            depthWrite={false}
          />
        </mesh>

        <Text
          ref={label}
          position={[0.75, 0, 0.02]}
          fontSize={1.85}
          color="#F2F5F3"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.09}
          renderOrder={4}
          material-transparent
          material-depthWrite={false}
        >
          {name}
        </Text>
      </Billboard>

      <group ref={ringGroup} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[at[0], 0.5, at[1]]}>
          <ringGeometry args={[SELECTION_RADIUS - 1.4, SELECTION_RADIUS, 56]} />
          <meshBasicMaterial
            ref={ringMaterial}
            color={STATUS_COLOR.powered}
            transparent
            opacity={0.6}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Every district plate. Mount once, inside the Canvas. */
export function ZoneLabels(): ReactElement {
  const centroids = useMemo(zoneCentroids, []);

  return (
    <group name="zone-labels">
      {Object.entries(centroids).map(([zone, at]) => (
        <ZoneLabel key={zone} zone={zone} at={at} />
      ))}
    </group>
  );
}
