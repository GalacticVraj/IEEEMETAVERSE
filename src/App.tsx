/**
 * App.tsx — GridGuard root: a single-page state machine.
 *
 * The camera and 3D scene persist across ALL five modes. Only the HUD layer
 * and camera behavior change. No page reloads, no route changes.
 *
 * Flow: Hero → Explore → CrisisSelect → ActiveCrisis → AfterAction
 */
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { type ReactElement, useRef } from 'react';
import * as THREE from 'three';

import type { AppConfig } from '@config';
import { DebugOverlay } from '@debug';

import {
  BusMarkers,
  GeneratorMarkers,
  GroundPlane,
  TransmissionLines,
} from './rendering/grid-scene';
import { CityLayout } from './rendering/city-layout';
import { OperatorPanel } from './ui/operator-panel/operator-panel';
import { HeroOverlay } from './ui/hero/HeroOverlay';
import { ExploreHud } from './ui/explore/ExploreHud';
import { CrisisSelectScreen } from './ui/crisis-select/CrisisSelectScreen';
import { AfterActionScreen } from './ui/after-action/AfterActionScreen';
import { useAppFlowStore, AppMode } from './state/app-flow-store';

export interface AppProps {
  readonly config: AppConfig;
}

// ---------------------------------------------------------------------------
// AutoOrbitCamera — slow cinematic orbit for Hero mode (~90s/revolution)
// ---------------------------------------------------------------------------
function AutoOrbitCamera({ enabled }: { enabled: boolean }) {
  const angle = useRef(0);

  useFrame(({ camera }, delta) => {
    if (!enabled) return;
    angle.current += delta * (2 * Math.PI / 90); // 90 seconds per revolution
    const radius = 200;
    const height = 140;
    camera.position.set(
      Math.sin(angle.current) * radius,
      height,
      Math.cos(angle.current) * radius,
    );
    camera.lookAt(new THREE.Vector3(0, 0, 0));
  });

  return null;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export function App({ config }: AppProps): ReactElement {
  const mode = useAppFlowStore((s) => s.mode);

  const isHero = mode === AppMode.Hero;
  const isExplore = mode === AppMode.Explore;
  const isCrisisSelect = mode === AppMode.CrisisSelect;
  const isActiveCrisis = mode === AppMode.ActiveCrisis;
  const isAfterAction = mode === AppMode.AfterAction;

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050a06', position: 'relative' }}>
      {/* ── Persistent 3D Canvas ─────────────────────────────────── */}
      <Canvas
        camera={{ position: [0, 140, 200], fov: 45, near: 1, far: 1200 }}
        style={{ position: 'absolute', inset: 0 }}
        shadows
      >
        {/* Warm golden-hour lighting (nature-forward, not cold-blue) */}
        <ambientLight intensity={0.25} color="#fef3c7" />
        <directionalLight
          position={[60, 120, 40]}
          intensity={1.8}
          color="#fde68a"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-40, 60, -20]} intensity={0.8} color="#74C69D" distance={250} />
        <pointLight position={[40, 30, 40]} intensity={0.5} color="#F4A300" distance={150} />

        {/* Grid infrastructure (always visible) */}
        <GroundPlane />
        <TransmissionLines />
        <BusMarkers />
        <GeneratorMarkers />

        {/* City dressing (always visible) */}
        <CityLayout />

        {/* Postprocessing */}
        <EffectComposer>
          <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.9} height={300} opacity={0.8} />
        </EffectComposer>

        {/* Camera behavior depends on mode */}
        <AutoOrbitCamera enabled={isHero || isCrisisSelect} />
        {(isExplore || isActiveCrisis || isAfterAction) && (
          <OrbitControls
            target={[0, 0, 0]}
            minDistance={30}
            maxDistance={350}
            maxPolarAngle={Math.PI / 2.1}
            enableDamping
            dampingFactor={0.05}
          />
        )}
      </Canvas>

      {/* ── DOM Overlays (mode-dependent) ────────────────────────── */}

      {/* Hero mode */}
      {isHero && <HeroOverlay />}

      {/* Explore mode */}
      {isExplore && <ExploreHud />}

      {/* Crisis Select */}
      {isCrisisSelect && <CrisisSelectScreen />}

      {/* Active Crisis — operator panel + existing HUD */}
      {isActiveCrisis && <OperatorPanel />}

      {/* After-Action */}
      {isAfterAction && <AfterActionScreen />}

      {/* Debug overlay (always available in dev) */}
      {config.debug.overlay ? <DebugOverlay seed={config.simulation.seed} /> : null}
    </div>
  );
}
