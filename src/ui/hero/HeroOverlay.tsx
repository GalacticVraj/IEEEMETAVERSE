/**
 * HeroOverlay.tsx — immersive console-style landing over the live daylight city.
 *
 * Vertically centered within the viewport regardless of screen size.
 * The live 3D scene in slow orbit IS the hero — the overlay stays out of
 * its way. Stat counters + keyboard hint add visual polish.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useAppFlowStore } from '../../state/app-flow-store';
import { useRuntime } from '../../runtime-context';
import { startDemo } from '../prefs/demo-driver';

/** Animate a number from 0 to target over `duration` ms. */
function AnimatedCounter({
  target,
  suffix = '',
  duration = 1800,
}: {
  target: number;
  suffix?: string;
  duration?: number;
}): ReactElement {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return (
    <>
      {value}
      {suffix}
    </>
  );
}

export function HeroOverlay(): ReactElement {
  const beginShift = useAppFlowStore((s) => s.beginShift);
  const runtime = useRuntime();

  // Keyboard shortcut: Enter to begin
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') beginShift();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [beginShift]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'none',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Top identity strip */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px 0',
        }}
      >
        <span
          className="console-value"
          style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', color: '#1C2530' }}
        >
          ⚡ GRIDGUARD
        </span>
        <span className="console-value" style={{ fontSize: 11, color: '#5A6774' }}>
          IEEE METAVERSE GRAND CHALLENGE 2026
        </span>
      </div>

      {/* Mission framing — absolutely centered */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 24px',
          minHeight: 0,
        }}
      >
        <div
          className="console-panel animate-fade-in-up"
          style={{
            padding: 'clamp(16px, 3vh, 28px) clamp(20px, 3vw, 36px)',
            maxWidth: 580,
            width: '100%',
            pointerEvents: 'auto',
            backdropFilter: 'blur(12px)',
            background: 'rgba(250, 250, 247, 0.92)',
          }}
        >
          <div className="console-section-title" style={{ marginBottom: 8 }}>
            Meridian Bay Grid Operations
          </div>
          <h1
            style={{
              fontSize: 'clamp(1.3rem, 3vw, 2.2rem)',
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: '#1C2530',
              fontWeight: 600,
              margin: 0,
            }}
          >
            You are the grid operator.
            <br />
            Keep the city powered through the crisis.
          </h1>
          <p
            style={{
              marginTop: 10,
              fontSize: 'clamp(12px, 1.4vw, 13.5px)',
              lineHeight: 1.6,
              color: '#5A6774',
            }}
          >
            A record heatwave is bearing down on Meridian Bay. Every decision — cutting AC, pausing
            EV charging, shedding industry — has a visible, physical consequence in the live
            simulation below.
          </p>

          {/* Animated stat counters */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 'clamp(16px, 3vw, 32px)',
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid #E7E9E6',
            }}
          >
            {(
              [
                { target: 8, suffix: '', label: 'CRISIS SCENARIOS' },
                { target: 418, suffix: '', label: 'PHYSICS TESTS' },
                { target: 3, suffix: '', label: 'CITY DISTRICTS' },
              ] as const
            ).map((stat) => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <div
                  className="console-value"
                  style={{
                    fontSize: 'clamp(18px, 2.5vw, 26px)',
                    fontWeight: 700,
                    color: '#22637E',
                  }}
                >
                  <AnimatedCounter target={stat.target} suffix={stat.suffix} />
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    color: '#8B97A3',
                    marginTop: 2,
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              marginTop: 18,
              flexWrap: 'wrap',
            }}
          >
            <button
              className="console-btn-primary"
              style={{ fontSize: 14, padding: '10px 32px' }}
              onClick={beginShift}
            >
              ⚡ Begin Shift
            </button>
            <button
              className="console-btn"
              style={{ fontSize: 14, padding: '10px 24px' }}
              onClick={() => startDemo(runtime)}
              title="Hands-free walkthrough of the full learning loop — every event is real"
            >
              ▶ Competition Demo
            </button>
          </div>

          {/* Keyboard hint */}
          <div style={{ marginTop: 10, fontSize: 10.5, color: '#8B97A3' }}>
            Press{' '}
            <kbd
              style={{
                padding: '1px 6px',
                borderRadius: 2,
                border: '1px solid #D3D7D2',
                background: '#F1F3F1',
                fontFamily: 'inherit',
                fontSize: 10,
              }}
            >
              Enter
            </kbd>{' '}
            to begin
          </div>
        </div>
      </div>

      {/* Bottom attribution */}
      <div style={{ paddingBottom: 12, textAlign: 'center', fontSize: 11, color: '#8B97A3' }}>
        GridGuard — simulation-based energy literacy. Live physics, no scripted numbers.
      </div>
    </div>
  );
}
