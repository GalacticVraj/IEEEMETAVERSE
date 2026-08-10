/**
 * ConsoleShell — the mission-control frame around the 3D city.
 *
 * ONE rail, not two. The old 300px-left / 320px-right split forced the player
 * to click a building in the centre, read the consequence at the far right,
 * and act at the far left — roughly 1,400px of eye travel per decision. Now
 * inspection lands directly above the actions that answer it, and the
 * right rail is gone entirely.
 *
 * Grid: 48px command bar / flexible centre / 176px timeline; 320px left rail
 * and an open centre (the CITY is the primary experience — the shell never
 * covers it). The container ignores pointer events; only panels receive them,
 * so the 3D scene stays fully interactive through the centre.
 *
 * Every region is wrapped in `Reveal`, which withholds it until the persona
 * tutorial discloses it. Outside the tutorial `Reveal` is inert.
 */
import { AppMode, useTutorialStore } from '@state';
import type { ReactElement } from 'react';

import { Reveal } from '../onboarding/Reveal';

import { CommandBar } from './CommandBar';
import { ContextInspector } from './ContextInspector';
import { GridHealthPanel } from './GridHealthPanel';
import { LearningFeedback } from './LearningFeedback';
import { OperatorActionsPanel } from './OperatorActionsPanel';
import { ScenarioPanel } from './ScenarioPanel';
import { Timeline } from './Timeline';

export function ConsoleShell({ mode }: { mode: AppMode }): ReactElement {
  const preflight = mode === AppMode.Tutorial;
  const teaching = useTutorialStore((s) => s.active);
  const scenarioReady = useTutorialStore((s) => s.revealed.has('scenario'));

  // During onboarding the third rail slot previews the operator levers, then
  // swaps to the scenario picker on the final beat. Sharing one slot keeps the
  // rail inside its ~676px budget at 1080p. When nobody is being taught
  // (veteran, skipped, or demo) the picker is simply there from the start.
  const showActionsPreview = preflight && teaching && !scenarioReady;
  const showScenario = preflight && !showActionsPreview;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        gridTemplateRows: '48px 1fr 176px',
        gridTemplateColumns: '320px 1fr',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {/* Top command bar — spans both columns */}
      <Reveal id="command" from="top" style={{ gridColumn: '1 / -1' }}>
        <CommandBar />
      </Reveal>

      {/* The one rail: vitals → what you clicked → what you can do about it.
          Vitals are PINNED; only the lower half scrolls, so the numbers that
          decide the run can never be scrolled out of sight mid-crisis. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 10,
          pointerEvents: 'none',
          minHeight: 0,
        }}
      >
        <Reveal id="health" from="left" style={{ flexShrink: 0 }}>
          <GridHealthPanel />
        </Reveal>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            overflowY: 'auto',
            minHeight: 0,
            pointerEvents: 'none',
            // Without this, Chrome's scroll anchoring "helpfully" scrolls down
            // by exactly the height of the inspect card the moment it appears
            // above the actions — pushing the thing you just clicked on out of
            // view. The card must land where the player is looking.
            overflowAnchor: 'none',
          }}
        >
          <Reveal id="inspect" from="left" style={{ flexShrink: 0 }}>
            <ContextInspector />
          </Reveal>

          {showActionsPreview && (
            <Reveal id="actions" from="left" style={{ flexShrink: 0 }}>
              <OperatorActionsPanel armed={false} />
            </Reveal>
          )}

          {showScenario && (
            <Reveal id="scenario" from="left" style={{ flexShrink: 0 }}>
              <ScenarioPanel />
            </Reveal>
          )}

          {!preflight && (
            <Reveal id="actions" from="left" style={{ flexShrink: 0 }}>
              <OperatorActionsPanel armed />
            </Reveal>
          )}
        </div>
      </div>

      {/* Centre — intentionally empty: the city IS the interface here */}
      <div />

      {/* Bottom timeline — spans both columns */}
      <Reveal id="timeline" from="bottom" style={{ gridColumn: '1 / -1', minHeight: 0 }}>
        <Timeline />
      </Reveal>

      {/* "Understanding" explains the FOCUSED TIMELINE EVENT, so it belongs
          beside the event stream that triggers it — not diagonally opposite. */}
      <Reveal
        id="timeline"
        from="right"
        style={{
          position: 'absolute',
          right: 14,
          // Clears the QuickControls chip row, which sits at bottom: 190.
          bottom: 226,
          width: 320,
          maxHeight: 240,
          overflowY: 'auto',
          zIndex: 21,
        }}
      >
        <LearningFeedback />
      </Reveal>
    </div>
  );
}
