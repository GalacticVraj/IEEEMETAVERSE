import type { ReactElement } from 'react';

/**
 * SCENE GRAPH responsibility (one half of Presentation): the structural 3D
 * world — city, zones, buildings, camera rig, lighting. It reads simulation
 * projections and positions/parameterizes meshes accordingly. It NEVER computes
 * simulation state.
 *
 * All three are Phase-1 placeholders that render nothing. Geometry lands in the
 * city-generation phase; load-reactive materials in the materials phase.
 */
export function SceneGraph(): ReactElement | null {
  // PHASE (city): instanced zones/buildings/roads driven by topology + state.
  return null;
}

export function CameraRig(): ReactElement | null {
  // PHASE (city): orbit/cinematic camera; GSAP tweens fired by director events.
  return null;
}

export function Lighting(): ReactElement | null {
  // PHASE (city): key/fill/ambient tuned per docs/design/lighting.md.
  return null;
}
