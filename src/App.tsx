/**
 * App.tsx — GridGuard root: a single-page state machine.
 *
 * The camera and 3D scene persist across ALL modes. Only the console overlay
 * changes. Flow (compressed ops flow): Hero → CrisisSelect → ActiveCrisis →
 * AfterAction. The city renders as a DAYLIGHT DIGITAL TWIN; the UI is a
 * mission-control shell that never covers the center.
 */
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { type ReactElement } from 'react';

import type { AppConfig } from '@config';
import { DebugOverlay } from '@debug';

import {
  BusMarkers,
  GeneratorMarkers,
  GroundPlane,
  TransmissionLines,
} from './rendering/grid-scene';
import { CameraDirector } from './rendering/camera/CameraDirector';
import { CameraHud } from './rendering/camera/CameraHud';
import { useCameraStore } from './rendering/camera/camera-store';
import { CityLayout } from './rendering/city-layout';
import { ConsoleShell } from './ui/console';
import { HeroOverlay } from './ui/hero/HeroOverlay';
import { AfterActionScreen } from './ui/after-action/AfterActionScreen';
import { useAppFlowStore, AppMode } from './state/app-flow-store';

export interface AppProps {
  readonly config: AppConfig;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export function App({ config }: AppProps): ReactElement {
  const mode = useAppFlowStore((s) => s.mode);
  const introActive = useCameraStore((s) => s.introActive);

  const isHero = mode === AppMode.Hero;
  const isCrisisSelect = mode === AppMode.CrisisSelect;
  const isActiveCrisis = mode === AppMode.ActiveCrisis;
  const isAfterAction = mode === AppMode.AfterAction;
  const isConsole = isCrisisSelect || isActiveCrisis || isAfterAction;

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#DDE3E8', position: 'relative' }}>
      {/* ── Persistent 3D Canvas ─────────────────────────────────── */}
      <Canvas
        camera={{ position: [0, 140, 200], fov: 45, near: 1, far: 1200 }}
        style={{ position: 'absolute', inset: 0 }}
        shadows
      >
        {/* Neutral daylight rig — digital twin, not golden-hour cinematics */}
        <color attach="background" args={['#DDE3E8']} />
        <ambientLight intensity={0.45} color="#F5F7FA" />
        <directionalLight
          position={[80, 140, 60]}
          intensity={1.6}
          color="#FFF4E0"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <hemisphereLight args={['#CBD9E6', '#B8B2A6', 0.5]} />

        {/* Grid infrastructure (always visible) */}
        <GroundPlane />
        <TransmissionLines />
        <BusMarkers />
        <GeneratorMarkers />

        {/* City dressing (always visible) */}
        <CityLayout />

        {/* Postprocessing — restrained: bloom only lifts true emissives */}
        <EffectComposer>
          <Bloom luminanceThreshold={0.75} luminanceSmoothing={0.9} height={300} opacity={0.35} />
        </EffectComposer>

        {/* ALL camera behavior — hero orbit, intro, focus, choreography — is
            owned by the one CameraDirector. Never mount another camera. */}
        <CameraDirector />
      </Canvas>

      {/* ── DOM Overlays (mode-dependent) ────────────────────────── */}

      {/* Hero mode */}
      {isHero && <HeroOverlay />}

      {/* Camera HUD: intro captions/skip + auto-follow/overview controls */}
      {isConsole && <CameraHud dev={config.debug.overlay} />}

      {/* Mission-control console — hidden until the intro lands at home */}
      {isConsole && !introActive && <ConsoleShell mode={mode} />}

      {/* After-Action report layered above the console */}
      {isAfterAction && <AfterActionScreen />}

      {/* Debug overlay (always available in dev) */}
      {config.debug.overlay ? <DebugOverlay seed={config.simulation.seed} /> : null}
    </div>
  );
}
