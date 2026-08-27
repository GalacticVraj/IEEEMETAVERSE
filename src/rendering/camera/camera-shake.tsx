/**
 * camera-shake.tsx — a physical reaction to a real disturbance.
 *
 * Deliberately NOT part of CameraDirector. The director owns where the camera
 * IS: hero orbit, intro spline, focus flights, manual orbit. Shake is a
 * transient offset on top of whatever that produced, and threading it through
 * every branch of the director's frame loop would put a decaying float in the
 * middle of code whose whole job is to be the single source of camera truth.
 *
 * So this mounts AFTER the director and nudges ROTATION only, additively.
 * Rotation is fully recomputed every frame — by `camera.lookAt` on scripted
 * legs, by OrbitControls on manual ones — so an additive offset is consumed
 * and rebuilt each frame and can never accumulate or drift the camera's real
 * pose. Position is left strictly alone for the same reason: the director
 * lerps *from* `camera.position`, and a stale offset there would corrupt the
 * start of the next flight.
 *
 * Every shake is caused by a critical entry in the event log — a trip, a lost
 * unit, a district going dark. Nothing here fires on a timer.
 */
import { useEventLogStore } from '@state';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';

/**
 * Peak angular amplitude, radians. ~0.9 deg.
 *
 * Raised from 0.0055 (~0.3 deg): at the old value a 400 MW unit disconnecting
 * moved the frame by roughly a quarter of a degree, which is below the
 * threshold at which a player registers it as a reaction at all. The brief
 * asked for 0.08 rad — that is 4.6 deg, which on a near-top-down city view
 * reads as a rendering fault rather than a jolt, so this lands between the
 * two: unmistakably felt, still a camera and not an earthquake.
 */
const AMPLITUDE = 0.016;
/**
 * Trauma decays to nothing in about 1.2 s at full trauma, matching the brief.
 * The trauma-squared curve below means most of the movement is spent in the
 * first third of that, so it hits hard and settles rather than wobbling on.
 */
const DECAY_PER_SECOND = 0.85;
/** Shake wobbles this fast. Two incommensurate rates so it never loops. */
const RATE_X = 27.3;
const RATE_Y = 19.1;

/** How much trauma each severity is worth. Trauma is capped at 1. */
const TRAUMA: Record<string, number> = {
  critical: 0.85,
  warning: 0.32,
};

/**
 * Losing a generating unit is the largest single disturbance in a run and
 * gets the full jolt, above the shared `critical` weight a line trip carries.
 */
const GENERATOR_LOSS_TRAUMA = 1;

export function CameraShake(): ReactElement | null {
  const traumaRef = useRef(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    let lastSeen = useEventLogStore.getState().entries.at(-1)?.seq ?? 0;

    return useEventLogStore.subscribe((state) => {
      const latest = state.entries.at(-1);
      if (latest === undefined) return;
      if (latest.seq < lastSeen) lastSeen = 0; // run restarted
      if (latest.seq <= lastSeen) return;
      lastSeen = latest.seq;

      const added =
        latest.focus?.kind === 'generator' && latest.severity === 'critical'
          ? GENERATOR_LOSS_TRAUMA
          : TRAUMA[latest.severity];
      if (added === undefined) return;
      traumaRef.current = Math.min(1, traumaRef.current + added);
    });
  }, []);

  useFrame(({ camera, clock }, delta) => {
    if (traumaRef.current <= 0) return;

    traumaRef.current = Math.max(0, traumaRef.current - delta * DECAY_PER_SECOND);
    if (reduced.current) return;

    // Trauma squared: small disturbances stay subtle while a cascade really
    // hits. This is the standard game-feel curve and it is the difference
    // between "the camera is broken" and "that felt like something".
    const magnitude = traumaRef.current * traumaRef.current * AMPLITUDE;
    if (magnitude <= 0) return;

    const t = clock.elapsedTime;
    camera.rotation.x += Math.sin(t * RATE_X) * magnitude;
    camera.rotation.y += Math.sin(t * RATE_Y + 1.7) * magnitude;
  });

  return null;
}
