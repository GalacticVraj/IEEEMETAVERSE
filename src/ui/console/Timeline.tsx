/**
 * Timeline — bottom strip: transport controls, a tick ruler with real event
 * markers, and the scrolling event stream. Every marker/entry comes from the
 * EventBus via the event-log store — no fabricated timeline entries.
 */
import {
  AppMode,
  useAppFlowStore,
  useEventLogStore,
  useGridStore,
  useSimulationStore,
} from '@state';
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';

import { useRuntime } from '../../runtime-context';
import { Tooltip } from '../common/Tooltip';
import { simClock } from './learning-copy';

/** Run length used to place markers on the ruler (session default). */
const RUN_TICKS = 1800;

const SEVERITY_COLOR: Record<string, string> = {
  info: '#8B97A3',
  caution: '#9A6B15',
  warning: '#B4531F',
  critical: '#B3261E',
  recovery: '#217A56',
};

function ClockIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function Timeline(): ReactElement {
  const runtime = useRuntime();
  const mode = useAppFlowStore((s) => s.mode);
  const tick = useGridStore((s) => s.tick);
  const lifecycle = useSimulationStore((s) => s.lifecycle);
  const entries = useEventLogStore((s) => s.entries);
  const focusEntry = useEventLogStore((s) => s.focusEntry);
  const focusedSeq = useEventLogStore((s) => s.focusedSeq);
  const clearLog = useEventLogStore((s) => s.clear);
  const streamRef = useRef<HTMLDivElement>(null);

  const paused = lifecycle === 'Paused';
  const active = mode === AppMode.ActiveCrisis;

  // Keep the stream pinned to the latest entry.
  useEffect(() => {
    const el = streamRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  const restart = (): void => {
    const id = runtime.session.activeScenarioId ?? useAppFlowStore.getState().selectedCrisis;
    if (id !== null) {
      clearLog();
      runtime.session.start(id);
    }
  };

  const progress = Math.min(1, tick / RUN_TICKS);

  return (
    <div
      className="console-panel animate-slide-down"
      style={{
        display: 'grid',
        gridTemplateColumns: '190px 1fr 340px',
        gap: 16,
        padding: '10px 16px',
        borderRadius: '8px 8px 0 0',
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        minHeight: 0,
      }}
    >
      {/* Transport & Identity */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#22637E', display: 'flex', alignItems: 'center' }}>
            <ClockIcon />
          </span>
          <span className="console-section-title" style={{ fontSize: 11, fontWeight: 700 }}>
            TIMELINE
          </span>
        </div>
        <div style={{ fontSize: 10.5, color: '#8B97A3', lineHeight: 1.1 }}>Major events that occurred during this simulation</div>

        <Tooltip
          title="Elapsed Physics Time"
          content="Tracks real simulation time (T+00:00 to T+03:00) driving heatwave load curves and scheduled scenario events."
          position="top"
        >
          <div
            className="metric-large"
            style={{ fontSize: 18, fontWeight: 700, color: '#1C2530', marginTop: 2, cursor: 'help' }}
          >
            {simClock(tick)}
          </div>
        </Tooltip>

        {active && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <Tooltip
              title={paused ? 'Resume Simulation Engine' : 'Pause Simulation Engine'}
              content={
                paused
                  ? 'Resumes real-time clock advancement and physics solver. Shortcut: SPACE'
                  : 'Freezes simulation clock and physics ticks. Allows inspecting corridor loading without time pressure. Shortcut: SPACE'
              }
              position="top"
            >
              <button
                className="console-btn"
                style={{ padding: '3px 10px', fontSize: 11, minHeight: 26 }}
                onClick={() => (paused ? runtime.session.resume() : runtime.session.pause())}
              >
                {paused ? '▶ Resume Run' : '⏸ Pause Run'}
              </button>
            </Tooltip>
            <Tooltip
              title="Restart Crisis Scenario"
              content="Resets clock to T+00:00, clears event log, and re-arms initial scenario faults. Use to test alternative operator strategies."
              position="top"
            >
              <button
                className="console-btn"
                style={{ padding: '3px 10px', fontSize: 11, minHeight: 26 }}
                onClick={restart}
              >
                🔄 Restart Run
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Ruler with event markers */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 6,
          minWidth: 0,
        }}
      >
        <div
          style={{
            position: 'relative',
            height: 28,
            background: 'rgba(241, 243, 241, 0.8)',
            border: '1px solid #D3D7D2',
            borderRadius: 6,
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          {/* Elapsed portion */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: `${progress * 100}%`,
              background: 'rgba(34, 99, 126, 0.12)',
              transition: 'width 0.2s linear',
            }}
          />
          {/* Event markers */}
          {entries.map((entry) => (
            <button
              key={entry.seq}
              title={`${simClock(entry.tick)} ${entry.title}`}
              onClick={() => focusEntry(entry.seq)}
              style={{
                position: 'absolute',
                left: `${Math.min(99.2, (entry.tick / RUN_TICKS) * 100)}%`,
                top: entry.severity === 'critical' ? 2 : 5,
                width: entry.severity === 'critical' ? 5 : 4,
                height: entry.severity === 'critical' ? 24 : 16,
                background: SEVERITY_COLOR[entry.severity] ?? '#8B97A3',
                border: 'none',
                borderRadius: 2,
                cursor: 'pointer',
                padding: 0,
                zIndex: 2,
              }}
            />
          ))}
          {/* Playhead */}
          <div
            style={{
              position: 'absolute',
              left: `${progress * 100}%`,
              top: 0,
              bottom: 0,
              width: 2,
              background: '#22637E',
              boxShadow: '0 0 4px rgba(34, 99, 126, 0.5)',
              zIndex: 3,
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: '#8B97A3',
            fontWeight: 600,
          }}
        >
          <span className="console-value">T+00:00 (Start)</span>
          <span className="console-value">T+03:00 (End)</span>
        </div>
      </div>

      {/* Event stream */}
      <div
        ref={streamRef}
        style={{
          overflowY: 'auto',
          minHeight: 0,
          paddingRight: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {entries.length === 0 ? (
          <div style={{ fontSize: 11, color: '#8B97A3', paddingTop: 12, textAlign: 'center' }}>
            Events will appear here as the crisis unfolds.
          </div>
        ) : (
          entries.slice(-40).map((entry) => (
            <Tooltip
              key={entry.seq}
              title={`Inspect Event: ${entry.title}`}
              content="Opens mentor card in the Understanding panel detailing root cause, grid impact, and recommended mitigation."
              position="left"
            >
              <button
                onClick={() => focusEntry(entry.seq)}
                style={{
                  display: 'flex',
                  gap: 8,
                  width: '100%',
                  textAlign: 'left',
                  background: focusedSeq === entry.seq ? 'rgba(34, 99, 126, 0.1)' : 'transparent',
                  border:
                    focusedSeq === entry.seq
                      ? '1px solid rgba(34, 99, 126, 0.2)'
                      : '1px solid transparent',
                  borderRadius: 4,
                  padding: '3px 6px',
                  cursor: 'pointer',
                  alignItems: 'baseline',
                  transition: 'background 120ms ease',
                }}
              >
                <span
                  className="console-value"
                  style={{ fontSize: 10, color: '#8B97A3', whiteSpace: 'nowrap', fontWeight: 600 }}
                >
                  {simClock(entry.tick)}
                </span>
                <span
                  className="console-value"
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: SEVERITY_COLOR[entry.severity] ?? '#1C2530',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.title}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    color: '#5A6774',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.detail}
                </span>
              </button>
            </Tooltip>
          ))
        )}
      </div>
    </div>
  );
}
