/**
 * HeroOverlay.tsx — minimal console-style landing over the live daylight city.
 *
 * No marketing chrome: identity, one line of mission framing, Begin Shift.
 * The live 3D scene in slow orbit IS the hero — the overlay stays out of
 * its way.
 */
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { CRISIS_CARDS, useAppFlowStore } from '../../state/app-flow-store';
import { useRuntime } from '../../runtime-context';
import { startDemo } from '../prefs/demo-driver';
import { LeaderboardPanel } from '../leaderboard/LeaderboardPanel';
import { principleAt } from './operating-principles';

/**
 * The scenario "Jump In" starts. Picked by declared difficulty rather than
 * hardcoded to a title, so adding a harder scenario changes this by itself.
 */
const HARDEST_SCENARIO_ID =
  CRISIS_CARDS.find((card) => card.difficulty === 'Critical')?.id ?? CRISIS_CARDS[0]?.id ?? 'storm';

/** How long each operating principle holds the screen, ms. */
const PRINCIPLE_ROTATE_MS = 9000;

export function HeroOverlay(): ReactElement {
  const beginShift = useAppFlowStore((s) => s.beginShift);
  const selectCrisis = useAppFlowStore((s) => s.selectCrisis);
  const runtime = useRuntime();
  const [showBoard, setShowBoard] = useState(false);
  const [principleIndex, setPrincipleIndex] = useState(0);

  const principle = principleAt(principleIndex);
  const hardestLabel =
    CRISIS_CARDS.find((card) => card.id === HARDEST_SCENARIO_ID)?.label ?? 'Crisis';

  useEffect(() => {
    const timer = setInterval(() => {
      setPrincipleIndex((index) => index + 1);
    }, PRINCIPLE_ROTATE_MS);
    return () => {
      clearInterval(timer);
    };
  }, []);

  /**
   * Straight into a scenario, skipping the walkthrough.
   *
   * `selectCrisis` both picks the scenario and moves the app to ActiveCrisis,
   * so the session start has to be driven here — the tutorial path normally
   * does it from the scenario picker.
   */
  const jumpIn = (scenarioId: string): void => {
    selectCrisis(scenarioId);
    runtime.session.start(scenarioId);
  };

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
        <div
          className="console-panel pointer-events-auto animate-fade-in-up"
          style={{ padding: '28px 36px', maxWidth: 560 }}
        >
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
            A record heatwave is bearing down on Meridian Bay. Every decision — cutting AC, pausing
            EV charging, shedding industry — has a visible, physical consequence in the live
            simulation below.
          </p>
          {/* Two ways in. "Start Training" teaches the console first; "Jump
              In" hands a returning player (or a judge with three minutes) the
              hardest scenario immediately. Both run the same simulation. */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              marginTop: 20,
              flexWrap: 'wrap',
            }}
          >
            <button
              className="console-btn-primary"
              style={{ fontSize: 14, padding: '10px 28px' }}
              onClick={beginShift}
            >
              Start Training
            </button>
            <button
              className="console-btn"
              style={{ fontSize: 14, padding: '10px 24px' }}
              onClick={() => {
                jumpIn(HARDEST_SCENARIO_ID);
              }}
              title={`Skip the walkthrough and start ${hardestLabel} immediately`}
            >
              Jump In — {hardestLabel}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              marginTop: 10,
              flexWrap: 'wrap',
            }}
          >
            <button
              className="console-btn"
              style={{ fontSize: 12, padding: '6px 16px', minHeight: 28 }}
              onClick={() => startDemo(runtime)}
              title="Hands-free walkthrough of the full learning loop — every event is real"
            >
              ▶ Competition Demo
            </button>
            <button
              className="console-btn"
              style={{ fontSize: 12, padding: '6px 16px', minHeight: 28 }}
              onClick={() => {
                setShowBoard(true);
              }}
              title="Operating standards for Meridian Bay, and your measured best on each scenario"
            >
              Standards & Your Best
            </button>
          </div>
        </div>

        {/* Rotating operating principle. Stated as doctrine, never as a quote
            attributed to anyone — see `operating-principles.ts`. */}
        <div
          key={principleIndex}
          className="animate-fade-in"
          style={{ maxWidth: 560, marginTop: 18, padding: '0 8px' }}
        >
          <div
            className="console-section-title"
            style={{ fontSize: 9.5, marginBottom: 4, color: '#8B97A3' }}
          >
            Operating principle
          </div>
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: '#5A6774' }}>{principle.text}</p>
          <p style={{ fontSize: 10, lineHeight: 1.5, color: '#8B97A3', marginTop: 4 }}>
            In this build: {principle.demonstratedBy}
          </p>
        </div>
      </div>

      {showBoard && (
        <LeaderboardPanel
          onClose={() => {
            setShowBoard(false);
          }}
        />
      )}

      {/* Bottom attribution */}
      <div className="pb-5 text-center" style={{ fontSize: 11, color: '#8B97A3' }}>
        GridGuard — simulation-based energy literacy. Live physics, no scripted numbers.
      </div>
    </div>
  );
}
