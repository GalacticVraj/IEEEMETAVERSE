/**
 * HeroOverlay.tsx — minimal console-style landing over the live daylight city.
 *
 * No marketing chrome: identity, one line of mission framing, Begin Shift.
 * The live 3D scene in slow orbit IS the hero — the overlay stays out of
 * its way.
 */
import type { ReactElement } from 'react';
import { useAppFlowStore } from '../../state/app-flow-store';
import { useRuntime } from '../../runtime-context';
import { startDemo } from '../prefs/demo-driver';

export function HeroOverlay(): ReactElement {
  const enterSimulation = useAppFlowStore((s) => s.enterSimulation);
  const runtime = useRuntime();

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col pointer-events-none"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Top identity strip */}
      <div className="w-full flex justify-between items-center px-6 pt-5">
        <span
          className="console-value"
          style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', color: '#1C2530' }}
        >
          GRIDGUARD
        </span>
        <span className="console-value" style={{ fontSize: 11, color: '#5A6774' }}>
          IEEE METAVERSE GRAND CHALLENGE 2026
        </span>
      </div>

      {/* Mission framing */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="console-panel pointer-events-auto animate-fade-in-up" style={{ padding: '28px 36px', maxWidth: 560 }}>
          <div className="console-section-title" style={{ marginBottom: 10 }}>
            Meridian Bay Grid Operations
          </div>
          <h1
            style={{
              fontSize: 'clamp(1.6rem, 3.4vw, 2.4rem)',
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: '#1C2530',
              fontWeight: 600,
            }}
          >
            You are the grid operator.
            <br />
            Keep the city powered through the crisis.
          </h1>
          <p style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.6, color: '#5A6774' }}>
            A record heatwave is bearing down on Meridian Bay. Every decision —
            cutting AC, pausing EV charging, shedding industry — has a visible,
            physical consequence in the live simulation below.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
            <button
              className="console-btn-primary"
              style={{ fontSize: 14, padding: '10px 32px' }}
              onClick={enterSimulation}
            >
              Begin Shift
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
        </div>
      </div>

      {/* Bottom attribution */}
      <div className="pb-5 text-center" style={{ fontSize: 11, color: '#8B97A3' }}>
        GridGuard — simulation-based energy literacy. Live physics, no scripted numbers.
      </div>
    </div>
  );
}
