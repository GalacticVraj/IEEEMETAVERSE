import { useUiStore } from '@state';
import { useEffect, type ReactElement } from 'react';

interface StepInfo {
  readonly step: number;
  readonly title: string;
  readonly targetName: string;
  readonly body: string;
  readonly tip: string;
  readonly position: React.CSSProperties;
}

const TOUR_STEPS: readonly StepInfo[] = [
  {
    step: 1,
    title: 'MISSION OVERVIEW',
    targetName: 'Welcome to GridGuard Digital Twin',
    body: 'GridGuard is an immersive smart-grid crisis simulator. You manage the power grid of Meridian Bay during extreme events.',
    tip: 'Your primary goal: Keep all 6 city districts powered without overloading transmission corridors.',
    position: { top: '80px', left: '50%', transform: 'translateX(-50%)' },
  },
  {
    step: 2,
    title: 'GRID HEALTH MONITOR',
    targetName: 'Live Network Telemetry',
    body: 'This panel shows live Demand, Generation, Balance, and Corridor Stress.',
    tip: 'Watch Corridor Stress carefully — protective relays trip lines at 100% thermal capacity!',
    position: { top: '100px', left: '330px' },
  },
  {
    step: 3,
    title: 'SCENARIO & OPERATOR LEVERS',
    targetName: 'Grid Control Levers',
    body: 'Select crisis scenarios (Heatwave, Storm) and execute operator actions to rebalance the grid.',
    tip: 'Operator interventions carry costs, benefits, and risks. Choose carefully under crisis pressure.',
    position: { top: '280px', left: '330px' },
  },
  {
    step: 4,
    title: 'TIMELINE & TRANSPORT',
    targetName: 'Simulation Playback & Event Stream',
    body: 'Track simulation ticks, inspect event log markers, and pause/resume execution.',
    tip: 'Shortcut: Press SPACE at any time to pause the simulation while analyzing options.',
    position: { bottom: '190px', left: '50%', transform: 'translateX(-50%)' },
  },
  {
    step: 5,
    title: '3D ASSET INSPECTOR',
    targetName: 'Interactive City Infrastructure',
    body: 'Click any transmission line, substation bus, or power plant directly on the 3D map.',
    tip: 'Selecting an asset smoothly reveals its Asset Inspector card with live flow telemetry.',
    position: { top: '100px', right: '350px' },
  },
  {
    step: 6,
    title: 'UNDERSTANDING & FEEDBACK',
    targetName: 'Evidence-Based Mentor Insights',
    body: 'When events occur, the Understanding panel explains what happened, why, and recommended fixes.',
    tip: 'No toast spam — just clear, actionable teaching cards when grid disturbances fire.',
    position: { top: '240px', right: '350px' },
  },
  {
    step: 7,
    title: 'DEVELOPER DEBUG TOOLS',
    targetName: 'Collapsible Telemetry Overlay',
    body: 'A compact floating debug pill is docked in the top-right corner.',
    tip: 'Click 🛠 DEBUG anytime to inspect seed, tick timing, and solver performance.',
    position: { top: '80px', right: '20px' },
  },
  {
    step: 8,
    title: 'OUTCOMES PRIMER',
    targetName: 'Measured After-Action Scorecard',
    body: 'Every decision you make here is measured, not graded on vibes. When your shift ends, you will see how well you kept the grid stable, how sound your trade-offs were, and how equitably the outcome landed across districts — the same numbers, run after run, so you can see yourself get better.',
    tip: 'Scorecard dimensions: Operational Performance, System Stability, Decision Quality, Resilience, and Equity & Critical Infrastructure.',
    position: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  },
];

function ShieldIcon(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function OnboardingTour(): ReactElement | null {
  const onboardingActive = useUiStore((s) => s.onboardingActive);
  const onboardingStep = useUiStore((s) => s.onboardingStep);
  const nextStep = useUiStore((s) => s.nextOnboardingStep);
  const prevStep = useUiStore((s) => s.prevOnboardingStep);
  const endTour = useUiStore((s) => s.endOnboarding);

  useEffect(() => {
    if (!onboardingActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        endTour();
      } else if (
        e.key === 'Enter' ||
        e.key === ' ' ||
        e.code === 'Space' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowDown'
      ) {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        prevStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onboardingActive, endTour, nextStep, prevStep]);

  if (!onboardingActive) return null;

  const current = TOUR_STEPS.find((s) => s.step === onboardingStep) ?? TOUR_STEPS[0]!;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        pointerEvents: 'auto',
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
      }}
      className="animate-fade-in"
    >
      {/* Tour Dialogue Box */}
      <div
        className="console-panel animate-scale-in"
        style={{
          position: 'absolute',
          ...current.position,
          width: 380,
          maxWidth: 'calc(100vw - 32px)',
          padding: '16px 18px',
          background: 'rgba(250, 250, 247, 0.98)',
          border: '1.5px solid #22637E',
          boxShadow: '0 12px 36px rgba(15, 23, 42, 0.25)',
          borderRadius: 10,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 5,
                background: '#22637E',
                color: '#FAFAF7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldIcon />
            </div>
            <span
              className="console-section-title"
              style={{ color: '#22637E', fontSize: 11, fontWeight: 700 }}
            >
              {current.title}
            </span>
          </div>
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
            STEP {current.step} OF {TOUR_STEPS.length}
          </span>
        </div>

        {/* Content */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1C2530', marginBottom: 4 }}>
          {current.targetName}
        </div>
        <p style={{ fontSize: 12, color: '#5A6774', lineHeight: 1.5, marginBottom: 10 }}>
          {current.body}
        </p>

        <div
          style={{
            background: 'rgba(34, 99, 126, 0.06)',
            borderLeft: '3px solid #22637E',
            padding: '8px 10px',
            borderRadius: 4,
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 11, color: '#22637E', lineHeight: 1.45, fontWeight: 500 }}>
            💡 <strong>Pro Tip:</strong> {current.tip}
          </div>
        </div>

        {/* Footer controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            className="console-btn"
            style={{ padding: '4px 10px', fontSize: 11, minHeight: 28 }}
            onClick={endTour}
          >
            Skip Tour
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {current.step > 1 && (
              <button
                className="console-btn"
                style={{ padding: '4px 12px', fontSize: 11, minHeight: 28 }}
                onClick={prevStep}
              >
                ◂ Back
              </button>
            )}
            <button
              className="console-btn-primary"
              style={{ padding: '4px 14px', fontSize: 11, minHeight: 28 }}
              onClick={nextStep}
            >
              {current.step === TOUR_STEPS.length ? 'Finish Tour ✓' : 'Next Step ▸'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
