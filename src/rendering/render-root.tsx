import type { ReactElement } from 'react';

import { EffectsPipeline } from './visual-effects';
import { CameraRig, Lighting, SceneGraph } from './scene-graph';

/**
 * The Presentation root. A later phase mounts a react-three-fiber `<Canvas>`
 * here; for now it composes the (empty) presentation pieces so the structure is
 * in place. The renderer subscribes to the event bus / reads projections — it
 * is a PURE CONSUMER of simulation state and never computes it.
 */
export function RenderRoot(): ReactElement {
  // PHASE (foundation+): wrap these in <Canvas dpr={[1, cfg.render.maxPixelRatio]}>.
  return (
    <>
      <Lighting />
      <CameraRig />
      <SceneGraph />
      <EffectsPipeline />
    </>
  );
}
