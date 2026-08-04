/**
 * ConsoleShell — the mission-control frame around the 3D city.
 *
 * Grid: 48px command bar / flexible center / 176px timeline; 300px-360px left rail,
 * open center (the CITY is the primary experience — the shell never covers
 * it), 300px-360px right rail. The container ignores pointer events; only panels
 * receive them, so the 3D scene stays fully interactive through the center.
 */
import { AppMode, useEventLogStore, useUiStore } from '@state';
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
  const selectedAsset = useUiStore((s) => s.selectedAsset);
  const entries = useEventLogStore((s) => s.entries);
  const focusedSeq = useEventLogStore((s) => s.focusedSeq);

  const hasFocusedEvent = focusedSeq !== null;
  const hasWarningOrCritical = entries.some(
    (e) => e.severity === 'warning' || e.severity === 'critical',
  );
  const showRightRail = selectedAsset !== null || hasFocusedEvent || hasWarningOrCritical;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        gridTemplateRows: '48px 1fr 176px',
        gridTemplateColumns: showRightRail
          ? 'clamp(300px, 22vw, 360px) 1fr clamp(300px, 22vw, 360px)'
          : 'clamp(300px, 22vw, 360px) 1fr 0px',
        transition: 'grid-template-columns 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'none',
        zIndex: 20,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Top command bar — spans all columns */}
      <div style={{ gridColumn: '1 / -1', pointerEvents: 'auto' }}>
        <CommandBar />
      </div>

      {/* Left rail: health + (scenario select | operator actions) */}
      <div
        className="console-rail-scroll"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 12,
          overflowY: 'auto',
          overflowX: 'hidden',
          pointerEvents: 'auto',
          minHeight: 0,
          maxHeight: '100%',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <GridHealthPanel />
        {selecting ? <ScenarioPanel /> : <OperatorActionsPanel />}
      </div>

      {/* Center — intentionally empty: the city IS the interface here */}
      <div />

      {/* Right rail: progressive reveal (inspector + learning feedback) */}
      <div
        className="console-rail-scroll"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: showRightRail ? 12 : 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          pointerEvents: 'auto',
          minHeight: 0,
          maxHeight: '100%',
          width: '100%',
          boxSizing: 'border-box',
          opacity: showRightRail ? 1 : 0,
          transition: 'opacity 0.3s ease, padding 0.3s ease',
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
