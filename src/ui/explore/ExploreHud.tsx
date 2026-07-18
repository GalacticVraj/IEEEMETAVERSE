/**
 * ExploreHud.tsx — Explore Mode HUD bar.
 *
 * Section 1.2: Shows a persistent "Enter Simulation" button once the player
 * has inspected at least one building OR after a 10-second grace period.
 * Also shows the currently-open InspectCard if any.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useAppFlowStore, type InspectCard } from '../../state/app-flow-store';

export function ExploreHud(): ReactElement {
  const enterSimulation = useAppFlowStore((s) => s.enterSimulation);
  const hasInspectedAny = useAppFlowStore((s) => s.hasInspectedAny);
  const exploreEnteredAt = useAppFlowStore((s) => s.exploreEnteredAt);
  const inspectedBuilding = useAppFlowStore((s) => s.inspectedBuilding);
  const closeInspectCard = useAppFlowStore((s) => s.closeInspectCard);

  const [showEnterBtn, setShowEnterBtn] = useState(false);

  useEffect(() => {
    if (hasInspectedAny) {
      setShowEnterBtn(true);
      return;
    }
    // 10-second grace period
    const elapsed = Date.now() - exploreEnteredAt;
    const remaining = Math.max(0, 10_000 - elapsed);
    const timer = setTimeout(() => setShowEnterBtn(true), remaining);
    return () => clearTimeout(timer);
  }, [hasInspectedAny, exploreEnteredAt]);

  return (
    <>
      {/* Top hint */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 animate-slide-down">
        <div className="glass-panel px-5 py-2.5 text-sm font-medium" style={{ color: '#D8F3DC' }}>
          🏙️ Explore Meridian Bay — Click buildings to learn about them
        </div>
      </div>

      {/* Bottom "Enter Simulation" bar */}
      {showEnterBtn && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 animate-fade-in-up">
          <button
            onClick={enterSimulation}
            className="btn-moss animate-pulse-glow"
            style={{ fontSize: '15px', padding: '14px 36px' }}
          >
            ⚡ Enter Simulation
          </button>
        </div>
      )}

      {/* Inspect Card overlay */}
      {inspectedBuilding && (
        <InspectCardOverlay card={inspectedBuilding} onClose={closeInspectCard} />
      )}
    </>
  );
}

function InspectCardOverlay({ card, onClose }: { card: InspectCard; onClose: () => void }) {
  const statusColors: Record<string, string> = {
    normal: '#74C69D',
    warning: '#F4A300',
    critical: '#E63946',
    blackout: '#ef4444',
  };

  return (
    <div className="absolute left-6 top-1/2 -translate-y-1/2 z-40 animate-fade-in-up" style={{ maxWidth: 340 }}>
      <div className="glass-panel-solid p-5">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 style={{ color: '#D8F3DC', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              {card.name}
            </h3>
            <span
              className="inline-block px-2 py-0.5 rounded-md text-xs font-semibold"
              style={{ background: 'rgba(116, 198, 157, 0.15)', color: '#74C69D' }}
            >
              {card.type.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ color: '#94a3b8', fontSize: 20, cursor: 'pointer', background: 'none', border: 'none', lineHeight: 1 }}
          >×</button>
        </div>

        {/* Status + Consumption */}
        <div className="flex gap-4 mb-3" style={{ fontSize: 13 }}>
          <div>
            <span style={{ color: '#94a3b8' }}>Status: </span>
            <span style={{ color: statusColors[card.status], fontWeight: 600 }}>
              {card.status.toUpperCase()}
            </span>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Load: </span>
            <span style={{ color: '#D8F3DC', fontWeight: 600 }}>{card.currentConsumptionKw} kW</span>
          </div>
        </div>

        {/* Flavor text */}
        <p style={{ color: 'rgba(216, 243, 220, 0.7)', fontSize: 13, lineHeight: 1.5, marginBottom: 10 }}>
          {card.flavorText}
        </p>

        {/* Teaching note */}
        <div
          className="rounded-lg px-3 py-2.5 mb-2"
          style={{ background: 'rgba(45, 106, 79, 0.2)', border: '1px solid rgba(116, 198, 157, 0.2)' }}
        >
          <p style={{ color: '#74C69D', fontSize: 12, lineHeight: 1.5 }}>
            {card.teachingNote}
          </p>
        </div>

        {/* Equity note (low-income only) */}
        {card.equityNote && (
          <div
            className="rounded-lg px-3 py-2"
            style={{ background: 'rgba(244, 163, 0, 0.1)', border: '1px solid rgba(244, 163, 0, 0.2)' }}
          >
            <p style={{ color: '#F4A300', fontSize: 11, lineHeight: 1.5 }}>
              ⚠ {card.equityNote}
            </p>
          </div>
        )}

        {/* Income tier badge */}
        {card.incomeTier && (
          <div className="mt-2" style={{ fontSize: 11, color: '#94a3b8' }}>
            Income tier: <span style={{ color: card.incomeTier === 'high' ? '#74C69D' : '#F4A300', fontWeight: 600 }}>
              {card.incomeTier.toUpperCase()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
