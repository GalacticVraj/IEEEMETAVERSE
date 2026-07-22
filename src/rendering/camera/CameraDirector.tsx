/**
 * CameraDirector — the ONE owner of all scripted camera movement.
 *
 * Consumes priority-resolved requests from the camera store and interpolates
 * them with frame-delta smootherstep easing. Manual OrbitControls mount only
 * while nothing scripted is in flight, so ownership is never split. All
 * vectors are preallocated — zero garbage in the frame loop. The director
 * reads projections only; it never touches simulation state.
 */
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';

import { AppMode, useAppFlowStore, useEventLogStore, useUiStore } from '@state';

import { BUS_POSITIONS } from '../layout';

import { BUILDING_POSITIONS } from './city-positions';
import { isFollowSuppressed, useCameraStore } from './camera-store';
import {
  INTRO_DURATION_S,
  INTRO_LEGS,
  OPERATOR_HOME,
  TIMING_SECONDS,
  frameNode,
  shotForDecision,
  shotForFocus,
} from './shots';
import type { CameraPose, Shot } from './shots';

/** Quintic smootherstep — gentle in, gentle out, zero jerk at the ends. */
const smootherstep = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Crisis-follow hold before returning to Operator Home. */
const CRISIS_HOLD_S = 4;
/** Decision-camera hold — long enough to see the simulation respond. */
const DECISION_HOLD_S = 3.5;
/** Marker shot the director expands into the intro spline. */
const INTRO_SHOT: Shot = { name: 'IntroSequence', pose: OPERATOR_HOME.pose };

type FlightPhase = 'moving' | 'holding' | 'returning';

interface Flight {
  seq: number;
  phase: FlightPhase;
  elapsed: number;
  duration: number;
  holdSeconds: number;
  returnTo: 'saved' | 'home' | 'none';
  isIntro: boolean;
  isReturnFromSelection: boolean;
  posCurve: THREE.CatmullRomCurve3 | null;
  tgtCurve: THREE.CatmullRomCurve3 | null;
  fromPos: THREE.Vector3;
  fromTgt: THREE.Vector3;
  toPos: THREE.Vector3;
  toTgt: THREE.Vector3;
}

/** Build the inspect shot for a selected asset (shared coordinate tables). */
function shotForSelection(kind: string, id: string): Shot | null {
  if (kind === 'line') return shotForFocus({ kind: 'line', id });
  if (kind === 'generator') return shotForFocus({ kind: 'generator', id });
  if (kind === 'bus') {
    const at = BUS_POSITIONS[id];
    return at === undefined ? null : frameNode('Inspect_Substation', at, { distance: 85 });
  }
  const at = BUILDING_POSITIONS[id];
  return at === undefined ? null : frameNode('Inspect_Building', at, { distance: 70, elevation: 0.5 });
}

export function CameraDirector(): ReactElement {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  const mode = useAppFlowStore((s) => s.mode);
  const request = useCameraStore((s) => s.request);
  const introActive = useCameraStore((s) => s.introActive);

  // Orbit target survives across handoffs; updated once per transition.
  const [orbitTarget, setOrbitTarget] = useState<readonly [number, number, number]>([0, 5, 0]);

  // ── Preallocated working memory — never allocated in the frame loop ──
  const flightRef = useRef<Flight | null>(null);
  const currentTargetRef = useRef(new THREE.Vector3(0, 5, 0));
  const heroAngleRef = useRef(0);
  const captionIndexRef = useRef(-1);
  const controlsRef = useRef<{ target: THREE.Vector3 } | null>(null);

  const scripted = request !== null;

  // ── Start the intro once, on Hero → console transition ──
  const prevModeRef = useRef(mode);
  useEffect(() => {
    const wasHero = prevModeRef.current === AppMode.Hero;
    prevModeRef.current = mode;
    const store = useCameraStore.getState();
    if (wasHero && mode === AppMode.CrisisSelect && !store.introDone) {
      store.setIntroActive(true);
      store.requestShot(INTRO_SHOT, { priority: 100, timing: 'CINEMATIC' });
    }
  }, [mode]);

  // ── Translate store requests into flights ──
  useEffect(() => {
    if (request === null) {
      flightRef.current = null;
      return;
    }
    const fromPos = new THREE.Vector3().copy(camera.position);
    const fromTgt = new THREE.Vector3().copy(currentTargetRef.current);

    if (request.shot.name === 'IntroSequence') {
      const posPoints = [
        fromPos.clone(),
        ...INTRO_LEGS.map((leg) => new THREE.Vector3(...leg.position)),
        new THREE.Vector3(...OPERATOR_HOME.pose.position),
      ];
      const tgtPoints = [
        fromTgt.clone(),
        ...INTRO_LEGS.map((leg) => new THREE.Vector3(...leg.target)),
        new THREE.Vector3(...OPERATOR_HOME.pose.target),
      ];
      const posCurve = new THREE.CatmullRomCurve3(posPoints, false, 'centripetal');
      const tgtCurve = new THREE.CatmullRomCurve3(tgtPoints, false, 'centripetal');
      posCurve.getLength(); // warm the arc-length cache outside the frame loop
      tgtCurve.getLength();
      flightRef.current = {
        seq: request.seq,
        phase: 'moving',
        elapsed: 0,
        duration: INTRO_DURATION_S,
        holdSeconds: 0,
        returnTo: 'none',
        isIntro: true,
        isReturnFromSelection: false,
        posCurve,
        tgtCurve,
        fromPos,
        fromTgt,
        toPos: new THREE.Vector3(...OPERATOR_HOME.pose.position),
        toTgt: new THREE.Vector3(...OPERATOR_HOME.pose.target),
      };
      captionIndexRef.current = -1;
      return;
    }

    flightRef.current = {
      seq: request.seq,
      phase: 'moving',
      elapsed: 0,
      duration: TIMING_SECONDS[request.timing],
      holdSeconds: request.holdSeconds ?? 0,
      returnTo: request.returnTo ?? 'none',
      isIntro: false,
      isReturnFromSelection: request.shot.name === 'Return',
      posCurve: null,
      tgtCurve: null,
      fromPos,
      fromTgt,
      toPos: new THREE.Vector3(...request.shot.pose.position),
      toTgt: new THREE.Vector3(...request.shot.pose.target),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- camera is stable; flights derive from requests only
  }, [request]);

  // ── User input cancels scripted motion (canvas pointer/wheel) ──
  useEffect(() => {
    if (!scripted) return;
    const cancel = (): void => {
      const store = useCameraStore.getState();
      if (store.introActive) store.markIntroDone();
      store.cancelScripted(performance.now());
      flightRef.current = null;
      setOrbitTarget([
        currentTargetRef.current.x,
        currentTargetRef.current.y,
        currentTargetRef.current.z,
      ]);
    };
    const dom = gl.domElement;
    dom.addEventListener('pointerdown', cancel);
    dom.addEventListener('wheel', cancel, { passive: true });
    return () => {
      dom.removeEventListener('pointerdown', cancel);
      dom.removeEventListener('wheel', cancel);
    };
  }, [scripted, gl]);

  // ── Selection → inspect shots (P90) with save/restore ──
  const selectedAsset = useUiStore((s) => s.selectedAsset);
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const store = useCameraStore.getState();
    const key = selectedAsset === null ? null : `${selectedAsset.kind}:${selectedAsset.id}`;
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = key;
    if (store.introActive) return;

    if (selectedAsset !== null && key !== prev) {
      const shot = shotForSelection(selectedAsset.kind, selectedAsset.id);
      if (shot === null) return;
      store.savePose({
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [
          currentTargetRef.current.x,
          currentTargetRef.current.y,
          currentTargetRef.current.z,
        ],
      });
      store.requestShot(shot, { priority: 90, timing: 'NORMAL' });
      return;
    }

    if (selectedAsset === null && prev !== null) {
      const saved = store.savedPose;
      if (saved !== null) {
        store.requestShot({ name: 'Return', pose: saved }, { priority: 90, timing: 'NORMAL' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- camera is stable
  }, [selectedAsset]);

  // ── Event log → decision (P95) and crisis-follow (P80) shots ──
  const lastSeenSeqRef = useRef(0);
  useEffect(() => {
    const unsubscribe = useEventLogStore.subscribe((state) => {
      const latest = state.entries[state.entries.length - 1];
      if (latest === undefined || latest.seq <= lastSeenSeqRef.current) return;
      lastSeenSeqRef.current = latest.seq;
      if (latest.focus === undefined) return;

      const store = useCameraStore.getState();
      if (store.introActive || !store.introDone) return;
      const now = performance.now();

      if (latest.focus.kind === 'decision') {
        const shot = shotForDecision(latest.focus.id);
        if (shot === null) return;
        store.requestShot(shot, {
          priority: 95,
          timing: 'SLOW',
          holdSeconds: DECISION_HOLD_S,
          returnTo: store.savedPose !== null ? 'saved' : 'home',
        });
        return;
      }

      // Crisis follow: only meaningful severities, only when invited.
      if (latest.severity !== 'critical' && latest.severity !== 'recovery') return;
      if (!store.autoFollow) return;
      if (isFollowSuppressed(store.lastUserInputAt, now)) return;
      if (useUiStore.getState().selectedAsset !== null) return;

      const shot = shotForFocus({ kind: latest.focus.kind, id: latest.focus.id });
      if (shot === null) return;
      const named = latest.severity === 'recovery' ? { ...shot, name: 'Recovery' } : shot;
      store.requestShot(named, {
        priority: 80,
        timing: 'SLOW',
        holdSeconds: CRISIS_HOLD_S,
        returnTo: 'home',
      });
    });
    return unsubscribe;
  }, []);

  // ── The frame loop — the only place the camera moves ──
  useFrame((_, delta) => {
    // Hero mode: ambient slow orbit (~90 s/revolution).
    if (mode === AppMode.Hero) {
      heroAngleRef.current += delta * ((2 * Math.PI) / 90);
      camera.position.set(
        Math.sin(heroAngleRef.current) * 200,
        140,
        Math.cos(heroAngleRef.current) * 200,
      );
      currentTargetRef.current.set(0, 0, 0);
      camera.lookAt(currentTargetRef.current);
      return;
    }

    const flight = flightRef.current;
    if (flight === null) {
      // Manual orbit: mirror the controls target so the next flight starts clean.
      const controls = controlsRef.current;
      if (controls !== null) currentTargetRef.current.copy(controls.target);
      return;
    }

    flight.elapsed += delta;
    const raw = flight.duration <= 0 ? 1 : flight.elapsed / flight.duration;

    if (flight.phase === 'holding') {
      if (flight.elapsed >= flight.holdSeconds) {
        // Begin the return leg.
        const store = useCameraStore.getState();
        const saved = store.savedPose;
        const homePose: CameraPose = OPERATOR_HOME.pose;
        const pose = flight.returnTo === 'saved' && saved !== null ? saved : homePose;
        flight.fromPos.copy(camera.position);
        flight.fromTgt.copy(currentTargetRef.current);
        flight.toPos.set(...pose.position);
        flight.toTgt.set(...pose.target);
        flight.phase = 'returning';
        flight.elapsed = 0;
        flight.duration = TIMING_SECONDS.NORMAL;
        store.setTransition('returning');
      }
      return;
    }

    const s = smootherstep(raw);
    if (flight.isIntro && flight.posCurve !== null && flight.tgtCurve !== null) {
      flight.posCurve.getPointAt(s, camera.position);
      flight.tgtCurve.getPointAt(s, currentTargetRef.current);
      camera.lookAt(currentTargetRef.current);
      // Caption keyed to spline progress (store write only on index change).
      const index = Math.min(INTRO_LEGS.length - 1, Math.floor(s * INTRO_LEGS.length));
      if (index !== captionIndexRef.current) {
        captionIndexRef.current = index;
        useCameraStore.getState().setCurrentShotName(INTRO_LEGS[index]?.caption ?? null);
      }
    } else {
      camera.position.lerpVectors(flight.fromPos, flight.toPos, s);
      currentTargetRef.current.lerpVectors(flight.fromTgt, flight.toTgt, s);
      camera.lookAt(currentTargetRef.current);
    }

    if (raw < 1) return;

    // Leg finished.
    const store = useCameraStore.getState();
    if (flight.phase === 'moving' && flight.holdSeconds > 0) {
      flight.phase = 'holding';
      flight.elapsed = 0;
      store.setTransition('holding');
      return;
    }

    // Fully complete (single leg or return leg done) → hand off to the user.
    if (flight.isIntro) store.markIntroDone();
    if (flight.isReturnFromSelection) store.clearSavedPose();
    if (flight.phase === 'returning' && flight.returnTo === 'saved') store.clearSavedPose();
    flightRef.current = null;
    setOrbitTarget([
      currentTargetRef.current.x,
      currentTargetRef.current.y,
      currentTargetRef.current.z,
    ]);
    store.completeRequest(flight.seq);
  });

  // Manual controls mount only when nothing scripted is in flight.
  const controlsActive = !scripted && !introActive && mode !== AppMode.Hero;

  return (
    <>
      {controlsActive && (
        <OrbitControls
          ref={(instance: { target: THREE.Vector3 } | null) => {
            controlsRef.current = instance;
          }}
          enablePan={false}
          minPolarAngle={0.35}
          maxPolarAngle={1.25}
          minDistance={80}
          maxDistance={420}
          enableDamping
          dampingFactor={0.08}
          target={orbitTarget}
          onStart={() => useCameraStore.getState().noteUserInput(performance.now())}
        />
      )}
    </>
  );
}
