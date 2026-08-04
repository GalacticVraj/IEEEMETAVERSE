/**
 * HeroOverlay.tsx — minimal console-style landing over the live daylight city.
 *
 * Implements the continuous narrative arc:
 * Movement 1: Prologue (Beats 1–3) — real-world stakes, live stochastic simulation, EIA data calibration.
 * Movement 2: Beat 4 — Meridian Bay Grid Operations mission brief card with Begin Shift.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useAppFlowStore } from '../../state/app-flow-store';
import { useRuntime } from '../../runtime-context';
import { startDemo } from '../prefs/demo-driver';
import { useCameraStore } from '../../rendering/camera/camera-store';
import { frameCity, OPERATOR_HOME, INTRO_LEGS } from '../../rendering/camera/shots';

const PROLOGUE_STORAGE_KEY = 'gridguard_has_seen_prologue';

interface PrologueBeat {
  readonly title: string;
  readonly subtitle: string;
  readonly lines: readonly string[];
  readonly shotIndex: number;
}

const PROLOGUE_BEATS: readonly PrologueBeat[] = [
  {
    title: 'THE STAKES',
    subtitle: 'Real-World Pressure',
    lines: [
      'Every summer, heatwaves push power grids past what they were built for.',
      'Somewhere, a grid operator has to decide — in real time — whose power stays on.',
    ],
    shotIndex: 0,
  },
  {
    title: 'THE MECHANISM',
    subtitle: 'Live Stochastic Twin',
    lines: [
      'GridGuard puts you in that seat.',
      "The load on this map isn't scripted. It's computed live, with real stochastic variation — the same kind of uncertainty a real operator works with.",
    ],
    shotIndex: 1,
  },
  {
    title: 'THE CALIBRATION',
    subtitle: 'EIA Grounded Physics',
    lines: [
      "The prices and renewable mix behind these numbers aren't invented.",
      "They're calibrated from U.S. Energy Information Administration data — so when a zone recovers slower than another, that's a real disparity, not a difficulty setting.",
    ],
    shotIndex: 3,
  },
];

export function HeroOverlay(): ReactElement {
  const enterSimulation = useAppFlowStore((s) => s.enterSimulation);
  const runtime = useRuntime();

  const [prologueStep, setPrologueStep] = useState<number>(() => {
    try {
      return sessionStorage.getItem(PROLOGUE_STORAGE_KEY) === 'true' ? 3 : 0;
    } catch {
      return 0;
    }
  });

  const finishPrologue = () => {
    try {
      sessionStorage.setItem(PROLOGUE_STORAGE_KEY, 'true');
    } catch {
      // Non-critical fallback if sessionStorage is restricted
    }
    setPrologueStep(3);
  };

  // Camera drift choreography during Prologue beats
  useEffect(() => {
    const store = useCameraStore.getState();
    if (prologueStep < 3) {
      const beat = PROLOGUE_BEATS[prologueStep];
      if (beat !== undefined) {
        const leg = INTRO_LEGS[beat.shotIndex];
        if (leg !== undefined) {
          store.requestShot(
            { name: `Prologue_${prologueStep}`, pose: { position: leg.position, target: leg.target } },
            { priority: 80, timing: 'NORMAL' },
          );
        }
      }
    } else {
      store.requestShot(OPERATOR_HOME, { priority: 80, timing: 'NORMAL' });
    }
  }, [prologueStep]);

  // Auto-advance timer (3s per beat)
  useEffect(() => {
    if (prologueStep >= 3) return;
    const timer = setTimeout(() => {
      setPrologueStep((prev) => prev + 1);
    }, 3200);
    return () => clearTimeout(timer);
  }, [prologueStep]);

  // Global Keyboard shortcuts during Prologue
  useEffect(() => {
    if (prologueStep >= 3) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finishPrologue();
      } else if (
        e.key === 'Enter' ||
        e.key === ' ' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowDown'
      ) {
        e.preventDefault();
        setPrologueStep((prev) => Math.min(3, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setPrologueStep((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prologueStep]);

  const currentBeat = prologueStep < 3 ? PROLOGUE_BEATS[prologueStep] : null;

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

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        {currentBeat !== null ? (
          /* ── Movement 1: Prologue Sequence (Beats 1–3) ── */
          <div
            className="console-panel pointer-events-auto animate-fade-in-up"
            style={{
              padding: '24px 32px',
              maxWidth: 580,
              width: '100%',
              borderRadius: 10,
              background: 'rgba(250, 250, 247, 0.98)',
              border: '1.5px solid #22637E',
              boxShadow: '0 16px 48px rgba(15, 23, 42, 0.3)',
              cursor: 'pointer',
            }}
            onClick={() => setPrologueStep((prev) => Math.min(3, prev + 1))}
          >
            {/* Header: Progress Badge + Skip Control */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <span
                className="console-value"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#5A6774',
                  background: 'rgba(34, 99, 126, 0.08)',
                  padding: '2px 8px',
                  borderRadius: 10,
                }}
              >
                STEP {prologueStep + 1} OF {PROLOGUE_BEATS.length}
              </span>

              <button
                className="console-btn"
                style={{
                  fontSize: 11,
                  padding: '3px 10px',
                  minHeight: 26,
                  color: '#5A6774',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  finishPrologue();
                }}
                title="Skip straight to Mission Briefing (Esc)"
              >
                Skip to Simulation ✕
              </button>
            </div>

            {/* Subtitle / Beat Title */}
            <div
              className="console-section-title"
              style={{ fontSize: 11, color: '#22637E', marginBottom: 6, fontWeight: 700 }}
            >
              {currentBeat.subtitle.toUpperCase()}
            </div>

            {/* Content Body */}
            <div style={{ marginTop: 6, marginBottom: 16 }}>
              {currentBeat.lines.map((line, idx) => (
                <p
                  key={idx}
                  style={{
                    fontSize: idx === 0 ? 15 : 13.5,
                    fontWeight: idx === 0 ? 600 : 400,
                    lineHeight: 1.55,
                    color: idx === 0 ? '#1C2530' : '#5A6774',
                    marginTop: idx > 0 ? 10 : 0,
                  }}
                >
                  {line}
                </p>
              ))}
            </div>

            {/* Indicator dots + Footer buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 18,
                paddingTop: 12,
                borderTop: '1px solid rgba(34, 99, 126, 0.12)',
              }}
            >
              {/* Step indicator dots */}
              <div style={{ display: 'flex', gap: 6 }}>
                {PROLOGUE_BEATS.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: i === prologueStep ? 18 : 6,
                      height: 6,
                      borderRadius: 3,
                      background: i === prologueStep ? '#22637E' : 'rgba(34, 99, 126, 0.25)',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                ))}
              </div>

              {/* Navigation buttons */}
              <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                {prologueStep > 0 && (
                  <button
                    className="console-btn"
                    style={{ padding: '4px 12px', fontSize: 11, minHeight: 28 }}
                    onClick={() => setPrologueStep((prev) => Math.max(0, prev - 1))}
                  >
                    ◂ Back
                  </button>
                )}
                <button
                  className="console-btn-primary"
                  style={{ padding: '4px 16px', fontSize: 11, minHeight: 28 }}
                  onClick={() => setPrologueStep((prev) => Math.min(3, prev + 1))}
                >
                  {prologueStep === PROLOGUE_BEATS.length - 1 ? 'Mission Brief ▸' : 'Next ▸'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ── Movement 2: Beat 4 Existing Mission Brief Card ── */
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
              A record heatwave is bearing down on Meridian Bay. Every decision — cutting AC,
              pausing EV charging, shedding industry — has a visible, physical consequence in the
              live simulation below.
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
        )}
      </div>

      {/* Bottom attribution */}
      <div className="pb-5 text-center" style={{ fontSize: 11, color: '#8B97A3' }}>
        GridGuard — simulation-based energy literacy. Live physics, no scripted numbers.
      </div>
    </div>
  );
}

