import type { ReactElement } from 'react';

import { DecisionWheel } from './decision-wheel/decision-wheel';
import { Hud } from './hud/hud';
import { ReplayControls } from './replay-controls/replay-controls';
import { TimelineBar } from './timeline/timeline-bar';

/**
 * Composes the 2D HUD overlay, absolutely positioned over the 3D canvas. Uses
 * `pointer-events-none` so the canvas stays interactive; individual controls
 * re-enable pointer events on themselves. Phase-1: all children are placeholders.
 */
export function AppShell(): ReactElement {
  return (
    <div className="pointer-events-none fixed inset-0">
      <Hud />
      <DecisionWheel />
      <TimelineBar />
      <ReplayControls />
    </div>
  );
}
