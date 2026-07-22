/**
 * CrisisSelectScreen.tsx — Section 4: Crisis Select modal.
 *
 * Three crisis cards over the (still-visible, gently orbiting) city.
 * Selecting a card transitions into Active Crisis Mode.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useAppFlowStore, CRISIS_CARDS } from '../../state/app-flow-store';
import { useRuntime } from '../../runtime-context';
import { LEARNER_TWIN } from '../../learning/twin/learner-twin';

export function CrisisSelectScreen(): ReactElement {
  const selectCrisis = useAppFlowStore((s) => s.selectCrisis);
  const runtime = useRuntime();
  const [recommendedId, setRecommendedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const twin = runtime.container.resolve(LEARNER_TWIN);
      const state = twin.state();
      if (state.weak_concept_tags.length > 0) {
        // Map concepts to scenarios
        const weak = state.weak_concept_tags[0]; // Take the first weak concept
        if (!weak) return;
        if (weak.includes('demand') || weak.includes('peak')) setRecommendedId('heatwave');
        else if (weak.includes('generation') || weak.includes('cost')) setRecommendedId('price_spike');
        else if (weak.includes('local') || weak.includes('overload')) setRecommendedId('demand_surge');
        else setRecommendedId('heatwave'); // fallback
      }
    } catch {
      // Twin might not be fully initialized or not found in container
    }
  }, [runtime]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-auto">
      {/* Dimmed backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(10, 31, 20, 0.6)', backdropFilter: 'blur(4px)' }} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-3xl px-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        {/* Title */}
        <div className="text-center mb-8">
          <h2
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              color: '#D8F3DC',
              textShadow: '0 2px 20px rgba(0,0,0,0.4)',
            }}
          >
            Choose Your Crisis
          </h2>
          <p style={{ color: 'rgba(216, 243, 220, 0.6)', fontSize: 14, marginTop: 8 }}>
            Each scenario stresses different parts of the grid. Select one to begin.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {CRISIS_CARDS.map((card, i) => (
            <button
              key={card.id}
              onClick={() => {
                // Start the REAL simulation run, then flip the UI mode.
                runtime.session.start(card.id);
                selectCrisis(card.id);
              }}
              className="glass-panel-solid p-6 text-left transition-all duration-300 hover:scale-[1.03] animate-fade-in-up cursor-pointer group"
              style={{
                animationDelay: `${0.2 + i * 0.15}s`,
                animationFillMode: 'both',
              }}
            >
              {/* Recommended badge */}
              {(card.recommended || recommendedId === card.id) && (
                <div
                  className="inline-block px-2 py-0.5 rounded-md text-xs font-semibold mb-3 animate-pulse"
                  style={{ background: 'rgba(244, 163, 0, 0.2)', color: '#F4A300' }}
                >
                  ✦ Recommended for you
                </div>
              )}

              {/* Difficulty */}
              <div style={{ fontSize: 11, marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>
                {card.difficulty}
              </div>

              {/* Label */}
              <h3 style={{ color: '#D8F3DC', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
                {card.label}
              </h3>

              {/* Description */}
              <p style={{ color: 'rgba(216, 243, 220, 0.6)', fontSize: 13, lineHeight: 1.5 }}>
                {card.description}
              </p>

              {/* Hover arrow */}
              <div
                className="mt-4 text-sm font-medium transition-all duration-300 group-hover:translate-x-1"
                style={{ color: '#74C69D' }}
              >
                Begin →
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
