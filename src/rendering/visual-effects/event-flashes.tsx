/**
 * event-flashes.tsx — the moment of cause, drawn where it happens.
 *
 * A line used to trip and the only evidence was a number changing in the rail
 * and a corridor turning red some frames later. The failure had no LOCATION.
 * This puts a flash and an expanding ring at the exact point of every real
 * disturbance, so the player sees WHERE the grid broke before they read WHAT
 * broke.
 *
 * Every effect is triggered by an entry in the event log, which is itself a
 * projection of real bus events — there is no decorative spawn path here, and
 * no timer that can fire without a simulation cause behind it. Position comes
 * from the static topology table.
 *
 * The pool is fixed and preallocated: no geometry, material or vector is
 * created during playback, and the frame loop allocates nothing.
 */
import { useEventLogStore } from '@state';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';

import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';

import { BUS_POSITIONS, zoneCentroids } from '../layout';

/** Concurrent effects. A cascade is the worst case and never exceeds this. */
const POOL = 10;

/** Effect lifetimes, seconds. */
const DURATION = { fault: 1.15, recovery: 1.5, decision: 1.35 } as const;

/** Ring radii, world units. */
const RING = { faultTo: 26, recoveryTo: 34, decisionTo: 44 } as const;

type Flavour = 'fault' | 'recovery' | 'decision';

const FLAVOUR_COLOR: Record<Flavour, string> = {
  fault: '#FF6B4A',
  recovery: '#3FD69A',
  decision: '#5AB6E8',
};

interface Slot {
  active: boolean;
  age: number;
  flavour: Flavour;
  x: number;
  z: number;
}

/** Where on the map an event happened, or null if it has no place. */
function locate(
  focus: { kind: string; id: string } | undefined,
  centroids: Readonly<Record<string, readonly [number, number]>>,
): readonly [number, number] | null {
  if (focus === undefined) return null;

  if (focus.kind === 'line') {
    const line = MERIDIAN_BAY_TOPOLOGY.lines.find((l) => (l.id as string) === focus.id);
    if (line === undefined) return null;
    const from = BUS_POSITIONS[line.from as string];
    const to = BUS_POSITIONS[line.to as string];
    if (from === undefined || to === undefined) return null;
    return [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  }

  if (focus.kind === 'generator') {
    const generator = MERIDIAN_BAY_TOPOLOGY.generators.find((g) => (g.id as string) === focus.id);
    if (generator === undefined) return null;
    return BUS_POSITIONS[generator.node as string] ?? null;
  }

  if (focus.kind === 'zone') return centroids[focus.id] ?? null;

  // A decision is city-wide: ripple from the middle of the map.
  if (focus.kind === 'decision') return [0, 0];

  return null;
}

const smoothstep = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export function EventFlashes(): ReactElement {
  const centroids = useMemo(zoneCentroids, []);
  const slots = useMemo<Slot[]>(
    () =>
      Array.from({ length: POOL }, () => ({
        active: false,
        age: 0,
        flavour: 'fault',
        x: 0,
        z: 0,
      })),
    [],
  );

  const groups = useRef<(THREE.Group | null)[]>(Array.from({ length: POOL }, () => null));
  const ringMaterials = useRef<(THREE.MeshBasicMaterial | null)[]>(
    Array.from({ length: POOL }, () => null),
  );
  const flareMaterials = useRef<(THREE.MeshBasicMaterial | null)[]>(
    Array.from({ length: POOL }, () => null),
  );
  const ringMeshes = useRef<(THREE.Mesh | null)[]>(Array.from({ length: POOL }, () => null));
  const flareMeshes = useRef<(THREE.Mesh | null)[]>(Array.from({ length: POOL }, () => null));

  const nextSlot = useRef(0);
  const colors = useMemo(
    () => ({
      fault: new THREE.Color(FLAVOUR_COLOR.fault),
      recovery: new THREE.Color(FLAVOUR_COLOR.recovery),
      decision: new THREE.Color(FLAVOUR_COLOR.decision),
    }),
    [],
  );

  // --- spawn, from real log entries ---------------------------------------
  useEffect(() => {
    let lastSeen = useEventLogStore.getState().entries.at(-1)?.seq ?? 0;

    return useEventLogStore.subscribe((state) => {
      const latest = state.entries.at(-1);
      if (latest === undefined) return;
      // A restart rewinds the log; re-arm rather than going silent forever.
      if (latest.seq < lastSeen) lastSeen = 0;
      if (latest.seq <= lastSeen) return;
      lastSeen = latest.seq;

      const at = locate(latest.focus, centroids);
      if (at === null) return;

      let flavour: Flavour;
      if (latest.focus?.kind === 'decision') flavour = 'decision';
      else if (latest.severity === 'recovery') flavour = 'recovery';
      else if (latest.severity === 'critical' || latest.severity === 'warning') flavour = 'fault';
      else return; // routine chatter gets no flash

      const slot = slots[nextSlot.current];
      nextSlot.current = (nextSlot.current + 1) % POOL;
      if (slot === undefined) return;
      slot.active = true;
      slot.age = 0;
      slot.flavour = flavour;
      slot.x = at[0];
      slot.z = at[1];
    });
  }, [centroids, slots]);

  // --- animate -------------------------------------------------------------
  useFrame((_, delta) => {
    for (let i = 0; i < POOL; i++) {
      const slot = slots[i];
      const group = groups.current[i] ?? null;
      if (slot === undefined || group === null) continue;

      if (!slot.active) {
        if (group.visible) group.visible = false;
        continue;
      }

      slot.age += delta;
      const life = DURATION[slot.flavour];
      const t = slot.age / life;
      if (t >= 1) {
        slot.active = false;
        group.visible = false;
        continue;
      }

      group.visible = true;
      group.position.set(slot.x, 1.2, slot.z);

      const color = colors[slot.flavour];
      const target =
        slot.flavour === 'fault'
          ? RING.faultTo
          : slot.flavour === 'recovery'
            ? RING.recoveryTo
            : RING.decisionTo;

      // Ring: fast out, fading as it goes. Eased so it leaves quickly and
      // decelerates — the shape of an actual shock front, not a linear wipe.
      const ring = ringMeshes.current[i] ?? null;
      const ringMaterial = ringMaterials.current[i] ?? null;
      if (ring !== null && ringMaterial !== null) {
        const radius = 1 + smoothstep(t) * target;
        ring.scale.set(radius, radius, 1);
        ringMaterial.color.copy(color);
        ringMaterial.opacity = (1 - t) * (1 - t) * 0.85;
      }

      // Flare: only faults get the hard initial pop, and it is gone in the
      // first fifth of the effect — a spark, not a lamp.
      const flare = flareMeshes.current[i] ?? null;
      const flareMaterial = flareMaterials.current[i] ?? null;
      if (flare !== null && flareMaterial !== null) {
        const pop = slot.flavour === 'fault' ? Math.max(0, 1 - t * 5) : 0;
        const scale = 0.6 + pop * 7;
        flare.scale.setScalar(scale);
        flareMaterial.color.copy(color);
        flareMaterial.opacity = pop;
      }
    }
  });

  return (
    <group name="event-flashes">
      {Array.from({ length: POOL }, (_, i) => (
        <group
          key={i}
          visible={false}
          ref={(node) => {
            groups.current[i] = node;
          }}
        >
          {/* Shock ring, laid flat on the ground at the fault location. */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            ref={(node) => {
              ringMeshes.current[i] = node;
            }}
          >
            <ringGeometry args={[0.86, 1, 40]} />
            <meshBasicMaterial
              ref={(node) => {
                ringMaterials.current[i] = node;
              }}
              transparent
              opacity={0}
              depthWrite={false}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>

          {/* The spark itself. `toneMapped={false}` keeps it above the bloom
              threshold so a trip actually blooms. */}
          <mesh
            position={[0, 1.6, 0]}
            ref={(node) => {
              flareMeshes.current[i] = node;
            }}
          >
            <sphereGeometry args={[1, 12, 12]} />
            <meshBasicMaterial
              ref={(node) => {
                flareMaterials.current[i] = node;
              }}
              transparent
              opacity={0}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
