/**
 * OperatorActionsPanel — the player's levers.
 *
 * Director prompts (urgent, scenario-driven decisions) render first; below
 * them the standing action catalog. Every execution emits a REAL
 * DecisionCommitted on the bus — the engine maps ids to load interventions.
 * The UI performs no simulation logic.
 */
import type { FrequencyMachine } from '@engine/frequency';
import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';
import { useAppFlowStore, useGridStore, useSimulationStore } from '@state';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { useRuntime } from '../../runtime-context';

import { commitDecision } from './commit-decision';
import { summariseLever } from './lever-projection';
import type { LeverSummary } from './lever-projection';
import { simClock } from './learning-copy';
import { OPERATOR_ACTIONS } from './operator-actions';
import type { OperatorAction } from './operator-actions';

/** Kind lookup so the projection can weigh inertia per machine. */
const GENERATOR_KIND: Readonly<Record<string, string>> = Object.fromEntries(
  MERIDIAN_BAY_TOPOLOGY.generators.map((g) => [g.id as string, g.kind as string]),
);

/**
 * What a lever would buy, computed by the SAME physics that will judge the
 * operator afterwards. Estimating this in the UI would eventually disagree
 * with the simulation, and a teaching tool that lies about consequence stops
 * teaching — so this runs the engine's what-if API against a copy of the live
 * operating point and never touches live state.
 */
function useProjection(reliefMw: number): LeverSummary | null {
  const generators = useGridStore((s) => s.generators);
  const frequency = useGridStore((s) => s.frequency);
  const totalGeneration = useGridStore((s) => s.totalGeneration);
  const totalLoad = useGridStore((s) => s.totalLoad);

  return useMemo(() => {
    if (generators.length === 0 || totalLoad <= 0) return null;
    const machines: FrequencyMachine[] = generators.map((g) => ({
      id: g.id,
      kind: GENERATOR_KIND[g.id as string] ?? 'Peaker',
      ratedMw: g.capacityMw,
      outputMw: g.outputMw,
      online: !g.tripped,
    }));
    return summariseLever(
      { machines, generationMw: totalGeneration, demandMw: totalLoad, frequencyHz: frequency },
      reliefMw,
    );
  }, [generators, frequency, totalGeneration, totalLoad, reliefMw]);
}

/**
 * The countdown ring beside a director prompt.
 *
 * Driven by SIMULATION ticks, not by a wall clock. Pause is a real, bound
 * control in this console (Space), and a `setInterval` countdown would keep
 * burning the operator's window while the physics stood still — punishing the
 * player for using a feature the game gave them.
 */
function DecisionCountdown({
  remaining,
  total,
}: {
  remaining: number;
  total: number;
}): ReactElement {
  const fraction = total <= 0 ? 0 : Math.max(0, Math.min(1, remaining / total));
  const seconds = Math.max(0, Math.ceil(remaining / 10));
  const RADIUS = 13;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const urgent = fraction < 0.34;
  const color = urgent ? '#B3261E' : fraction < 0.67 ? '#B4531F' : '#22637E';

  return (
    <span
      style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}
      title={`${String(seconds)} s to answer before the default is taken`}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r={RADIUS} fill="none" stroke="#E2E6E1" strokeWidth="3" />
        <circle
          cx="16"
          cy="16"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          // Starts at 12 o'clock and drains clockwise, like every other timer
          // anyone has ever read.
          transform="rotate(-90 16 16)"
          style={{ transition: 'stroke-dashoffset 120ms linear, stroke 300ms ease' }}
        />
      </svg>
      <span
        className="console-value"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          color,
        }}
      >
        {seconds}
      </span>
    </span>
  );
}

interface ActiveDecision {
  readonly decisionId: string;
  readonly prompt: string;
  readonly options: readonly string[];
  readonly requestedAtTick: number;
  readonly windowTicks: number;
  readonly defaultOptionIndex: number;
}

function DirectorPrompt(): ReactElement | null {
  const runtime = useRuntime();
  const activeDecision = useSimulationStore((s) => s.activeDecision as ActiveDecision | null);
  const tick = useSimulationStore((s) => s.tick);
  // Guards the auto-default against firing twice while the commit round-trips
  // through the bus and back into this projection.
  const autoFired = useRef<string | null>(null);

  const elapsed = activeDecision === null ? 0 : tick - activeDecision.requestedAtTick;
  const remaining = activeDecision === null ? 0 : activeDecision.windowTicks - elapsed;

  // Missed window: the grid does not wait for an operator, so the declared
  // default is taken and the run records that it was taken FOR them.
  useEffect(() => {
    if (activeDecision === null) return;
    if (remaining > 0) return;
    if (autoFired.current === activeDecision.decisionId) return;
    autoFired.current = activeDecision.decisionId;

    const index = activeDecision.defaultOptionIndex;
    const label = activeDecision.options[index] ?? 'No action';
    commitDecision(
      runtime,
      activeDecision.decisionId,
      index,
      `Missed window — auto-default: ${label}`,
    );
  }, [activeDecision, remaining, runtime]);

  if (activeDecision === null) return null;

  const expired = remaining <= 0;

  return (
    <div
      style={{
        border: `1px solid ${expired ? '#B3261E' : '#B4531F'}`,
        borderRadius: 2,
        padding: '8px 10px',
        background: expired ? 'rgba(179, 38, 30, 0.07)' : 'rgba(180, 83, 31, 0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="console-section-title" style={{ color: '#B4531F', marginBottom: 4 }}>
            {expired ? 'Missed Window' : 'Decision Required'}
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#1C2530', marginBottom: 6 }}>
            {activeDecision.prompt}
          </div>
        </div>
        {!expired && <DecisionCountdown remaining={remaining} total={activeDecision.windowTicks} />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {activeDecision.options.map((option, index) => (
          <button
            key={option}
            className="console-btn"
            style={{ textAlign: 'left', fontSize: 11.5 }}
            disabled={expired}
            onClick={() => commitDecision(runtime, activeDecision.decisionId, index, option)}
          >
            {option}
          </button>
        ))}
      </div>
      {!expired && (
        <div style={{ fontSize: 10, color: '#8B97A3', marginTop: 5, lineHeight: 1.4 }}>
          If you do not answer, the grid takes “
          {activeDecision.options[activeDecision.defaultOptionIndex] ?? 'no action'}” for you.
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }): ReactElement {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 9,
        color: '#8B97A3',
        fontSize: 9,
        transform: open ? 'rotate(90deg)' : 'none',
        transition: 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      ▸
    </span>
  );
}

/**
 * One lever.
 *
 * Collapsed it shows the two things that decide the next thirty seconds: what
 * the lever is, and what the engine's own what-if says it would buy. The
 * cost/benefit/risk copy expands on demand.
 *
 * This is not a cosmetic choice. Fully expanded, five of these measured 871px
 * inside a rail that is 191px tall at 1366x768 - four of the five levers were
 * below an invisible fold. Collapsed they all fit on screen, and no
 * information was removed to get there.
 */
function ActionRow({
  action,
  committedAtTick,
  armed,
  expanded,
  onToggle,
  onExecute,
}: {
  action: OperatorAction;
  committedAtTick: number | undefined;
  armed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExecute: () => void;
}): ReactElement {
  const committed = committedAtTick !== undefined;
  const projection = useProjection(action.reliefMw);

  return (
    <div style={{ borderBottom: '1px solid #E7E9E6', padding: '6px 0' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
      >
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          title={expanded ? 'Hide cost, benefit and risk' : 'Show cost, benefit and risk'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left',
            minWidth: 0,
            flex: 1,
            font: 'inherit',
          }}
        >
          <Chevron open={expanded} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: committed ? '#8B97A3' : '#1C2530',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {action.label}
          </span>
        </button>
        {committed ? (
          <span
            className="console-value"
            style={{ fontSize: 10, color: '#217A56', whiteSpace: 'nowrap' }}
          >
            COMMITTED · {simClock(committedAtTick)}
          </span>
        ) : (
          <button
            className="console-btn"
            style={{ padding: '3px 10px', fontSize: 11, minHeight: 24, flexShrink: 0 }}
            onClick={onExecute}
            disabled={!armed}
            title={armed ? undefined : 'Levers arm when the shift starts'}
          >
            Execute
          </button>
        )}
      </div>

      {/* The measured consequence stays visible whether or not the row is
          open - it is the number the decision actually turns on. */}
      {!committed && projection !== null && (
        <div
          className="console-value"
          style={{
            marginTop: 2,
            marginLeft: 15,
            fontSize: 10,
            lineHeight: 1.35,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#1C2530', fontWeight: 700 }}>−{action.reliefMw} MW</span>
          {projection.overshoots ? (
            // Shedding a grid that is already balanced pushes frequency ABOVE
            // nominal. Reporting the raw rise as a gain would recommend
            // causing an over-frequency excursion.
            // Kept to one line on a 260px rail on purpose: wrapped, five of
            // these rows push the last lever back below the fold. The amber
            // already says "don't"; the expanded detail carries the rest.
            <span style={{ color: '#9A6B15', fontWeight: 700 }}>
              overshoots to {projection.projectedHz.toFixed(2)} Hz
            </span>
          ) : projection.helps ? (
            <span style={{ color: '#217A56', fontWeight: 700 }}>
              +{projection.deviationImprovementHz.toFixed(2)} Hz toward 60
            </span>
          ) : (
            <span style={{ color: '#8B97A3' }}>no measurable change</span>
          )}
          {projection.avertsShedding && (
            <span style={{ color: '#217A56', fontWeight: 700 }}>avoids load shedding</span>
          )}
          {!projection.avertsShedding && projection.wouldStillShed && (
            <span style={{ color: '#B3261E', fontWeight: 700 }}>still sheds</span>
          )}
        </div>
      )}

      {expanded && (
        <div style={{ marginLeft: 15, marginTop: 4 }}>
          <div style={{ fontSize: 10.5, color: '#5A6774', lineHeight: 1.4 }}>
            {action.plainEffect}
          </div>
          <div style={{ fontSize: 10, color: '#8B97A3', marginTop: 3 }}>Cost: {action.cost}</div>
          <div style={{ fontSize: 10, color: '#217A56' }}>Benefit: {action.benefit}</div>
          <div style={{ fontSize: 10, color: '#9A6B15' }}>Risk: {action.risk}</div>
        </div>
      )}
    </div>
  );
}

/**
 * `armed` is false while the persona tutorial previews the levers before a
 * shift has started — the player can read every cost/benefit/risk, but
 * committing a decision at tick 0 against a stopped session would be
 * meaningless, so Execute stays disabled until the run begins.
 */
export function OperatorActionsPanel({ armed = true }: { armed?: boolean }): ReactElement {
  const runtime = useRuntime();
  const selectedCrisis = useAppFlowStore((s) => s.selectedCrisis);
  const [committed, setCommitted] = useState<Record<string, number>>({});
  // Accordion: at most one lever's detail copy is open at a time, so the panel
  // cannot grow back past the fold it was just rescued from.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // A new run re-arms every action.
  useEffect(() => {
    setCommitted({});
  }, [selectedCrisis]);

  const execute = (action: OperatorAction): void => {
    const { tick } = useGridStore.getState();
    commitDecision(runtime, `${action.id}-${tick}`, 0, action.label);
    setCommitted((previous) => ({ ...previous, [action.id]: tick }));
  };

  return (
    <div
      className="console-panel"
      style={{
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="console-section-title">Operator Actions</span>
        <span style={{ fontSize: 9.5, color: '#8B97A3' }}>
          {OPERATOR_ACTIONS.length} levers · click a name for detail
        </span>
      </div>
      {!armed && (
        <div style={{ fontSize: 10.5, color: '#8B97A3', lineHeight: 1.45 }}>
          These arm the moment your shift starts.
        </div>
      )}
      <DirectorPrompt />
      <div>
        {OPERATOR_ACTIONS.map((action) => (
          <ActionRow
            key={action.id}
            action={action}
            committedAtTick={committed[action.id]}
            armed={armed}
            expanded={expandedId === action.id}
            onToggle={() =>
              setExpandedId((previous) => (previous === action.id ? null : action.id))
            }
            onExecute={() => execute(action)}
          />
        ))}
      </div>
    </div>
  );
}
