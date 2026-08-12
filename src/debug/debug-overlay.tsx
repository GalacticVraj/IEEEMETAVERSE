import { useState, useRef } from 'react';
import type { ReactElement, PointerEvent } from 'react';

import { useSimulationStore, useUiStore } from '@state';

import { useRenderStatsStore } from './render-stats-store';

export interface DebugOverlayProps {
  readonly seed: number;
}

interface MetricRowProps {
  readonly label: string;
  readonly value: string;
}

function MetricRow({ label, value }: MetricRowProps): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
        padding: '2px 0',
      }}
    >
      <span style={{ color: '#94A3B8' }}>{label}</span>
      <span style={{ color: '#F8FAFC', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

/**
 * Developer overlay — compact, secondary floating widget docked in the screen corner.
 * Can be collapsed into a floating pill or expanded on click. Draggable around screen.
 */
export function DebugOverlay({ seed }: DebugOverlayProps): ReactElement | null {
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number }>({
    x: 0,
    y: 0,
    posX: 0,
    posY: 0,
  });

  const tick = useSimulationStore((state) => state.tick);
  const simTime = useSimulationStore((state) => state.simTime);
  const lifecycle = useSimulationStore((state) => state.lifecycle);
  const maxLoading = useSimulationStore((state) => state.maxLineLoading);
  // Real renderer numbers, sampled inside the Canvas by RenderStatsProbe.
  // These rows used to be hardcoded to "60" and "18.4 MB" — a debug overlay
  // that reports invented telemetry is worse than none.
  const stats = useRenderStatsStore();
  const setDebugOverlay = useUiStore((state) => state.setDebugOverlay);
  const close = (): void => {
    setDebugOverlay(false);
  };

  const onboardingActive = useUiStore((s) => s.onboardingActive);

  // The developer overlay is not part of the player-facing tour — it stays out
  // of the way for the whole of it rather than reappearing on a hardcoded step.
  if (onboardingActive) {
    return null;
  }

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    isDraggingRef.current = true;
    const currentX = position?.x ?? window.innerWidth - 220;
    const currentY = position?.y ?? 56;
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: currentX, posY: currentY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: Math.max(10, Math.min(window.innerWidth - 200, dragStartRef.current.posX + dx)),
      y: Math.max(10, Math.min(window.innerHeight - 100, dragStartRef.current.posY + dy)),
    });
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>): void => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // safe ignore
    }
  };

  const posStyle = position
    ? { left: `${position.x}px`, top: `${position.y}px`, right: 'auto' }
    : { top: '54px', right: '16px' };

  if (!expanded) {
    return (
      <div
        style={{
          position: 'fixed',
          ...posStyle,
          zIndex: 60,
          pointerEvents: 'auto',
          userSelect: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <button
          onClick={() => setExpanded(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 20,
            padding: '4px 10px',
            color: '#E2E8F0',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            transition: 'all 0.15s ease',
          }}
          title="Click to expand developer debug overlay (draggable)"
        >
          <span style={{ color: '#38BDF8' }}>●</span>
          <span>DEBUG</span>
          <span style={{ opacity: 0.6, fontSize: 9 }}>T+{tick}</span>
        </button>
        {/* A real dismiss. The pill previously offered only "click to expand",
            so once the overlay was up the sole way to remove it was
            Ctrl+Shift+D — undiscoverable, and it read as stuck on screen. */}
        <button
          onClick={close}
          aria-label="Close debug overlay"
          title="Close debug overlay (Ctrl+Shift+D)"
          style={{
            marginLeft: 4,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 20,
            color: '#E2E8F0',
            cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            lineHeight: 1,
            padding: '5px 7px',
          }}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        ...posStyle,
        width: 220,
        zIndex: 60,
        pointerEvents: 'auto',
        userSelect: 'none',
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 8,
        padding: '10px 12px',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        color: '#94A3B8',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
      }}
      className="animate-scale-in"
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: 6,
          marginBottom: 8,
          cursor: 'grab',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#38BDF8' }}>●</span>
          <span
            style={{
              textTransform: 'uppercase',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#F8FAFC',
              fontSize: 10,
            }}
          >
            GridGuard Debug
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Minimise back to the pill. This control used to be an ✕, which
              read as "close" but only shrank the panel — the overlay never
              actually went away. */}
          <button
            onClick={() => setExpanded(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              fontSize: 12,
              padding: '0 4px',
              lineHeight: 1,
            }}
            aria-label="Minimise debug overlay"
            title="Minimise to pill"
          >
            —
          </button>
          <button
            onClick={close}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              fontSize: 12,
              padding: '0 4px',
              lineHeight: 1,
            }}
            aria-label="Close debug overlay"
            title="Close debug overlay (Ctrl+Shift+D)"
          >
            ✕
          </button>
        </div>
      </div>

      <MetricRow label="seed" value={String(seed)} />
      <MetricRow label="state" value={lifecycle} />
      <MetricRow label="tick" value={String(tick)} />
      <MetricRow label="sim time" value={`${simTime.toFixed(1)}s`} />
      <MetricRow label="max loading" value={maxLoading.toFixed(2)} />
      <MetricRow label="fps" value={stats.fps === 0 ? '—' : String(stats.fps)} />
      <MetricRow label="draw calls" value={String(stats.drawCalls)} />
      <MetricRow label="triangles" value={stats.triangles.toLocaleString()} />
      <MetricRow
        label="memory"
        value={stats.heapMb === null ? 'n/a' : `${String(stats.heapMb)} MB`}
      />
    </div>
  );
}
