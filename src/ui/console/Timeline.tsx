/**
 * Timeline — bottom strip: transport controls, a tick ruler with real event
 * markers, and the scrolling event stream. Every marker/entry comes from the
 * EventBus via the event-log store — no fabricated timeline entries.
 */
import { AppMode, useAppFlowStore, useEventLogStore, useGridStore, useSimulationStore } from '@state';
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';

import { useRuntime } from '../../runtime-context';

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
      className="console-panel"
      style={{
        display: 'grid',
        gridTemplateColumns: '170px 1fr 340px',
        gap: 14,
        padding: '10px 14px',
        borderRadius: 0,
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        minHeight: 0,
      }}
    >
      {/* Transport */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="console-section-title">Timeline</div>
        <div className="console-value" style={{ fontSize: 16, fontWeight: 600 }}>{simClock(tick)}</div>
        {active && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="console-btn"
              style={{ padding: '3px 10px', fontSize: 11 }}
              onClick={() => (paused ? runtime.session.resume() : runtime.session.pause())}
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button className="console-btn" style={{ padding: '3px 10px', fontSize: 11 }} onClick={restart}>
              Restart Run
            </button>
          </div>
        )}
      </div>

      {/* Ruler with event markers */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, minWidth: 0 }}>
        <div
          style={{
            position: 'relative',
            height: 26,
            background: '#F1F3F1',
            border: '1px solid #D3D7D2',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {/* Elapsed portion */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: `${progress * 100}%`,
              background: 'rgba(34, 99, 126, 0.10)',
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
                top: entry.severity === 'critical' ? 2 : 6,
                width: entry.severity === 'critical' ? 5 : 4,
                height: entry.severity === 'critical' ? 22 : 14,
                background: SEVERITY_COLOR[entry.severity] ?? '#8B97A3',
                border: 'none',
                borderRadius: 1,
                cursor: 'pointer',
                padding: 0,
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
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8B97A3' }}>
          <span className="console-value">T+00:00</span>
          <span className="console-value">T+03:00</span>
        </div>
      </div>

      {/* Event stream */}
      <div ref={streamRef} style={{ overflowY: 'auto', minHeight: 0, paddingRight: 4 }}>
        {entries.length === 0 ? (
          <div style={{ fontSize: 11, color: '#8B97A3', paddingTop: 8 }}>
            Events will appear here as the crisis unfolds.
          </div>
        ) : (
          entries.slice(-40).map((entry) => (
            <button
              key={entry.seq}
              onClick={() => focusEntry(entry.seq)}
              style={{
                display: 'flex',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                background: focusedSeq === entry.seq ? '#F0F4F6' : 'transparent',
                border: 'none',
                borderRadius: 2,
                padding: '2px 4px',
                cursor: 'pointer',
                alignItems: 'baseline',
              }}
            >
              <span className="console-value" style={{ fontSize: 10, color: '#8B97A3', whiteSpace: 'nowrap' }}>
                {simClock(entry.tick)}
              </span>
              <span
                className="console-value"
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
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
          ))
        )}
      </div>
    </div>
  );
}
