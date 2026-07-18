/**
 * App — the vertical slice root.
 *
 * Renders:
 *   - A full-screen react-three-fiber Canvas containing the GridScene
 *   - The OperatorPanel HUD overlay (DOM, on top of the canvas)
 *   - The DebugOverlay in development
 *
 * This replaces the foundation-screen placeholder. All simulation state
 * flows via stores — no business logic lives here.
 */
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import type { ReactElement } from 'react';

import type { AppConfig } from '@config';
import { DebugOverlay } from '@debug';

import {
  BusMarkers,
  GeneratorMarkers,
  GroundPlane,
  TransmissionLines,
} from './rendering/grid-scene';
import { OperatorPanel } from './ui/operator-panel/operator-panel';

export interface AppProps {
  readonly config: AppConfig;
}

export function App({ config }: AppProps): ReactElement {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f172a', position: 'relative' }}>
      {/* Three.js canvas fills the screen */}
      <Canvas
        camera={{ position: [0, 180, 60], fov: 50, near: 1, far: 1000 }}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[50, 100, 50]} intensity={1.2} castShadow />

        {/* Grid */}
        <GroundPlane />
        <TransmissionLines />
        <BusMarkers />
        <GeneratorMarkers />

        {/* Camera control */}
        <OrbitControls
          target={[0, 0, 0]}
          minDistance={40}
          maxDistance={400}
          maxPolarAngle={Math.PI / 2.2}
        />
      </Canvas>

      {/* DOM overlay: operator panel (always visible) */}
      <OperatorPanel />

      {/* Dev debug overlay */}
      {config.debug.overlay ? <DebugOverlay seed={config.simulation.seed} /> : null}
    </div>
  );
}
