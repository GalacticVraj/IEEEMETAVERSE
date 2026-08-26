/**
 * App.tsx — GridGuard root: a single-page state machine.
 *
 * The camera and 3D scene persist across ALL modes. Only the console overlay
 * changes. Flow (compressed ops flow): Hero → Tutorial → ActiveCrisis →
 * AfterAction. The city renders as a DAYLIGHT DIGITAL TWIN; the UI is a
 * mission-control shell that never covers the center.
 */
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useEffect, type ReactElement } from 'react';

import type { AppConfig } from '@config';
import { DebugOverlay, RenderStatsProbe } from '@debug';

import {
  BusMarkers,
  GeneratorMarkers,
  GroundPlane,
  TransmissionLines,
} from './rendering/grid-scene';
import { BusLabels } from './rendering/bus-labels';
import { CameraShake } from './rendering/camera/camera-shake';
import { EventFlashes } from './rendering/visual-effects/event-flashes';
import { StormEffects } from './rendering/visual-effects/storm';
import { CameraDirector } from './rendering/camera/CameraDirector';
import { CameraHud } from './rendering/camera/CameraHud';
import { useCameraStore } from './rendering/camera/camera-store';
import { Atmosphere } from './rendering/atmosphere';
import { CityLayout } from './rendering/city-layout';
import { SelectionChip } from './rendering/selection-chip';
import { TimeOfDayRig } from './rendering/TimeOfDayRig';
import { AdvisorCard } from './ui/advisor/AdvisorCard';
import { ConsoleShell } from './ui/console';
import { HeroOverlay } from './ui/hero/HeroOverlay';
import { TutorialManager } from './ui/onboarding';
import { QuickControls } from './ui/prefs/QuickControls';
import { OnboardingTour } from './ui/onboarding/OnboardingTour';
import { AfterActionScreen } from './ui/after-action/AfterActionScreen';
import { useUiStore } from './state/ui-store';
import { useAppFlowStore, AppMode } from './state/app-flow-store';
import { useTutorialStore } from './state/tutorial-store';

export interface AppProps {
  readonly config: AppConfig;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export function App({ config }: AppProps): ReactElement {
  const mode = useAppFlowStore((s) => s.mode);
  const debugOverlayVisible = useUiStore((s) => s.debugOverlayVisible);
  const setDebugOverlay = useUiStore((s) => s.setDebugOverlay);
  const introActive = useCameraStore((s) => s.introActive);
  const beginTutorial = useTutorialStore((s) => s.begin);
  const teaching = useTutorialStore((s) => s.active);

  const isHero = mode === AppMode.Hero;
  const isTutorial = mode === AppMode.Tutorial;
  const isActiveCrisis = mode === AppMode.ActiveCrisis;
  const isAfterAction = mode === AppMode.AfterAction;
  const isConsole = isTutorial || isActiveCrisis || isAfterAction;

  // Entering the pre-flight mode either starts the tutorial (first visit) or
  // hands a returning operator the fully assembled console. `begin` reads the
  // persisted flag, so this one call covers both.
  useEffect(() => {
    if (isTutorial) beginTutorial();
  }, [isTutorial, beginTutorial]);

  // The developer overlay is opt-in only — `?debug` in the URL seeds it, and
  // Ctrl+Shift+D toggles it at runtime. It must never greet a player, so the
  // config profile no longer decides this.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setDebugOverlay(!useUiStore.getState().debugOverlayVisible);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setDebugOverlay]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#DDE3E8', position: 'relative' }}>
      {/* ── Persistent 3D Canvas ─────────────────────────────────── */}
      <Canvas
        camera={{ position: [0, 140, 200], fov: 45, near: 1, far: 1200 }}
        style={{ position: 'absolute', inset: 0 }}
        shadows
      >
        {/* Time-of-day rig: afternoon → dusk → night, driven by the sim tick.
            The heatwave peaks into the evening — physics and drama align. */}
        <color attach="background" args={['#DDE3E8']} />
        <fog attach="fog" args={['#DDE3E8', 420, 1100]} />
        <TimeOfDayRig />

        {/* Grid infrastructure (always visible) */}
        <GroundPlane />
        <TransmissionLines />
        <BusMarkers />
        <GeneratorMarkers />
        <BusLabels />

        {/* City dressing (always visible) */}
        <CityLayout />
        <Atmosphere />

        {/* Cause, drawn where it happened: a flash and a shock ring at the
            exact point of every real trip, loss, blackout and restoration. */}
        <EventFlashes />

        {/* Lightning, but only while the weather model reports a Storm. */}
        <StormEffects />

        {/* The selected asset labels itself where it stands — the answer
            starts at the object, the depth continues in the left rail. */}
        {isConsole && <SelectionChip />}

        {/* Postprocessing — restrained: bloom only lifts true emissives */}
        <EffectComposer>
          <Bloom luminanceThreshold={0.75} luminanceSmoothing={0.9} height={300} opacity={0.35} />
        </EffectComposer>

        {/* ALL camera behavior — hero orbit, intro, focus, choreography — is
            owned by the one CameraDirector. Never mount another camera. */}
        <CameraDirector />

        {/* Mounted AFTER the director on purpose: shake is an additive
            rotation offset applied on top of whatever pose the director just
            produced. See camera-shake.tsx. */}
        <CameraShake />

        {/* Renderer instrumentation — must live inside the Canvas to reach
            `gl.info`. Renders nothing. */}
        <RenderStatsProbe />
      </Canvas>

      {/* ── DOM Overlays (mode-dependent) ────────────────────────── */}

      {/* Hero mode */}
      {isHero && <HeroOverlay />}

      {/* Camera HUD: intro captions/skip + auto-follow/overview controls.
          Withheld while Davis is teaching — he hasn't introduced these yet,
          and their chip row sits exactly where his dialogue does. The intro's
          own captions and Skip control always survive. */}
      {isConsole && (introActive || !teaching) && <CameraHud dev={config.debug.overlay} />}

      {/* Mission-control console — hidden until the intro lands at home */}
      {isConsole && !introActive && <ConsoleShell mode={mode} />}

      {/* In-play advisor: one evidence-grounded message at a time */}
      {isActiveCrisis && !introActive && <AdvisorCard />}

      {/* Preference chips + keyboard shortcuts — same reasoning as above */}
      {isConsole && !introActive && !teaching && <QuickControls />}

      {/* Persona onboarding — Davis introduces one panel at a time. Replaced
          the old MissionBriefing card, which could only list rules at you. */}
      {isTutorial && !introActive && <TutorialManager />}

      {/* Progressive step-by-step tour, opened on demand from QuickControls.
          Gated exactly like QuickControls — while Davis is teaching, his dialogue
          owns the screen and the two must never stack. */}
      {isConsole && !introActive && !teaching && <OnboardingTour />}

      {/* After-Action report layered above the console */}
      {isAfterAction && <AfterActionScreen />}

      {/* Developer overlay — opt-in via `?debug` or Ctrl+Shift+D, never by profile */}
      {debugOverlayVisible ? <DebugOverlay seed={config.simulation.seed} /> : null}
    </div>
  );
}
