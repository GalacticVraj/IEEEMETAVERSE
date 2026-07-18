import type { ReactElement } from 'react';

/**
 * VISUAL EFFECTS responsibility (the other half of Presentation): post-
 * processing (bloom, vignette, SSAO, chromatic aberration), particles (sparks
 * on transformer failure), and event-triggered animation. Split from the scene
 * graph so neither becomes a monolith.
 *
 * CRITICAL: every effect here must be triggered by a simulation event — no
 * decorative or ambient animation without a traceable cause (see
 * docs/design/motion.md and docs/architecture/renderer-purity.md).
 *
 * Phase-1 placeholder: renders nothing.
 */
export function EffectsPipeline(): ReactElement | null {
  return null;
}
