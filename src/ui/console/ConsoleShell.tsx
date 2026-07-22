/**
 * ConsoleShell — the mission-control frame around the 3D city.
 *
 * Grid: 48px command bar / flexible center / 176px timeline; 300px left rail,
 * open center (the CITY is the primary experience — the shell never covers
 * it), 320px right rail. The container ignores pointer events; only panels
 * receive them, so the 3D scene stays fully interactive through the center.
 */
import { AppMode } from '@state';
import type { ReactElement } from 'react';

import { AssetInspector } from './AssetInspector';
import { CommandBar } from './CommandBar';
import { GridHealthPanel } from './GridHealthPanel';
import { LearningFeedback } from './LearningFeedback';
import { OperatorActionsPanel } from './OperatorActionsPanel';
import { ScenarioPanel } from './ScenarioPanel';
import { Timeline } from './Timeline';

export function ConsoleShell({ mode }: { mode: AppMode }): ReactElement {
  const selecting = mode === AppMode.CrisisSelect;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        gridTemplateRows: '48px 1fr 176px',
        gridTemplateColumns: '300px 1fr 320px',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {/* Top command bar — spans all columns */}
      <div style={{ gridColumn: '1 / -1', pointerEvents: 'auto' }}>
        <CommandBar />
      </div>

      {/* Left rail: health + (scenario select | operator actions) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 10,
          overflowY: 'auto',
          pointerEvents: 'auto',
          minHeight: 0,
        }}
      >
        <GridHealthPanel />
        {selecting ? <ScenarioPanel /> : <OperatorActionsPanel />}
      </div>

      {/* Center — intentionally empty: the city IS the interface here */}
      <div />

      {/* Right rail: inspector + learning feedback */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 10,
          overflowY: 'auto',
          pointerEvents: 'auto',
          minHeight: 0,
        }}
      >
        <AssetInspector />
        <LearningFeedback />
      </div>

      {/* Bottom timeline — spans all columns */}
      <div style={{ gridColumn: '1 / -1', pointerEvents: 'auto', minHeight: 0 }}>
        <Timeline />
      </div>
    </div>
  );
}
