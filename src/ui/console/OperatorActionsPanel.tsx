/**
 * OperatorActionsPanel — the player's levers.
 *
 * Director prompts (urgent, scenario-driven decisions) render first; below
 * them the standing action catalog. Every execution emits a REAL
 * DecisionCommitted on the bus — the engine maps ids to load interventions.
 * The UI performs no simulation logic.
 */
import { asDecisionId, asSeconds } from '@app-types';
import { GRID_EVENT } from '@constants';
import { projectAction } from '@engine/frequency';
import type { FrequencyMachine } from '@engine/frequency';
import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';
import { useAppFlowStore, useGridStore, useSimulationStore } from '@state';
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import type { AppRuntime } from '@infra';

import { useRuntime } from '../../runtime-context';

import { simClock } from './learning-copy';
import { OPERATOR_ACTIONS } from './operator-actions';
import type { OperatorAction } from './operator-actions';

/** Kind lookup so the projection can weigh inertia per machine. */
const GENERATOR_KIND: Readonly<Record<string, string>> = Object.fromEntries(
  MERIDIAN_BAY_TOPOLOGY.generators.map((g) => [g.id as string, g.kind as string]),
);

/** How far ahead the projection looks: 5 s at the 10 Hz tick rate. */
const PROJECTION_TICKS = 50;
const PROJECTION_TIMESTEP_S = 0.1;

interface LeverProjection {
  readonly deltaHz: number;
  readonly avertsShedding: boolean;
  readonly wouldShed: boolean;
}

/**
 * What a lever would buy, computed by the SAME physics that will judge the
 * operator afterwards. Estimating this in the UI would eventually disagree
 * with the simulation, and a teaching tool that lies about consequence stops
 * teaching — so this calls the engine's what-if API against a copy of the
 * live operating point and never touches live state.
 */
function useProjection(reliefMw: number): LeverProjection | null {
  const generators = useGridStore((s) => s.generators);
  const frequency = useGridStore((s) => s.frequency);
  const totalGeneration = useGridStore((s) => s.totalGeneration);
  const totalLoad = useGridStore((s) => s.totalLoad);

  return useMemo(() => {
    if (generators.length === 0) return null;
    const machines: FrequencyMachine[] = generators.map((g) => ({
      id: g.id,
      kind: GENERATOR_KIND[g.id as string] ?? 'Peaker',
      ratedMw: g.capacityMw,
      outputMw: g.outputMw,
      online: !g.tripped,
    }));
    const base = {
      machines,
      generationMw: totalGeneration,
      demandMw: totalLoad,
      frequencyHz: frequency,
      timestepS: PROJECTION_TIMESTEP_S,
      horizonTicks: PROJECTION_TICKS,
    };
    const doNothing = projectAction({ ...base, loadReliefMw: 0 });
    const withAction = projectAction({ ...base, loadReliefMw: reliefMw });
    return {
      deltaHz: withAction.finalFrequencyHz - doNothing.finalFrequencyHz,
      avertsShedding: doNothing.uflsWouldFire && !withAction.uflsWouldFire,
      wouldShed: withAction.uflsWouldFire,
    };
  }, [generators, frequency, totalGeneration, totalLoad, reliefMw]);
}

/** Emit a DecisionCommitted with REAL tick + telemetry, and journal it. */
function commitDecision(
  runtime: AppRuntime,
  decisionId: string,
  optionIndex: number,
  label: string,
): void {
  const { tick, simTime, maxLineLoading } = useSimulationStore.getState();
  (runtime.kernel.events as { emit(n: string, p: unknown): void }).emit(
    GRID_EVENT.DecisionCommitted,
    {
      decisionId: asDecisionId(decisionId),
      optionIndex,
      simTime: asSeconds(simTime),
    },
  );
  useAppFlowStore.getState().logDecision({
    tick,
    action: { type: decisionId, label },
    zoneId: 'grid',
    zoneIncomeTier: null,
    alternativesConsidered: [
      {
        action: { type: 'no-action', label: 'Do nothing' },
        projectedMaxLineLoading: maxLineLoading,
      },
    ],
  });
}

function DirectorPrompt(): ReactElement | null {
  const runtime = useRuntime();
  const activeDecision = useSimulationStore(
    (s) =>
      s.activeDecision as {
        decisionId: string;
        prompt: string;
        options: readonly string[];
      } | null,
  );

  if (activeDecision === null) return null;

  return (
    <div
      style={{
        border: '1px solid #B4531F',
        borderRadius: 2,
        padding: '8px 10px',
        background: 'rgba(180, 83, 31, 0.06)',
      }}
    >
      <div className="console-section-title" style={{ color: '#B4531F', marginBottom: 4 }}>
        Decision Required
      </div>
      <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#1C2530', marginBottom: 6 }}>
        {activeDecision.prompt}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {activeDecision.options.map((option, index) => (
          <button
            key={option}
            className="console-btn"
            style={{ textAlign: 'left', fontSize: 11.5 }}
            onClick={() => commitDecision(runtime, activeDecision.decisionId, index, option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionRow({
  action,
  committedAtTick,
  armed,
  onExecute,
}: {
  action: OperatorAction;
  committedAtTick: number | undefined;
  armed: boolean;
  onExecute: () => void;
}): ReactElement {
  const committed = committedAtTick !== undefined;
  const projection = useProjection(action.reliefMw);
  return (
    <div style={{ borderBottom: '1px solid #E7E9E6', padding: '7px 0' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: committed ? '#8B97A3' : '#1C2530' }}>
          {action.label}
        </span>
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
            style={{ padding: '3px 10px', fontSize: 11 }}
            onClick={onExecute}
            disabled={!armed}
            title={armed ? undefined : 'Levers arm when the shift starts'}
          >
            Execute
          </button>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: '#5A6774', marginTop: 2 }}>{action.plainEffect}</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 3, fontSize: 10, color: '#8B97A3' }}>
        <span>Cost: {action.cost}</span>
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#8B97A3' }}>
        <span style={{ color: '#217A56' }}>Benefit: {action.benefit}</span>
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#8B97A3' }}>
        <span style={{ color: '#9A6B15' }}>Risk: {action.risk}</span>
      </div>
      {!committed && projection !== null && (
        <div
          className="console-value"
          style={{
            marginTop: 4,
            paddingTop: 4,
            borderTop: '1px solid #E4E8E3',
            fontSize: 10,
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#5A6774' }}>Projected</span>
          <span style={{ color: '#1C2530', fontWeight: 700 }}>−{action.reliefMw} MW</span>
          <span style={{ color: projection.deltaHz > 0.001 ? '#217A56' : '#8B97A3' }}>
            {projection.deltaHz >= 0 ? '+' : '−'}
            {Math.abs(projection.deltaHz).toFixed(2)} Hz
          </span>
          {projection.avertsShedding && (
            <span style={{ color: '#217A56', fontWeight: 700 }}>avoids load shedding</span>
          )}
          {!projection.avertsShedding && projection.wouldShed && (
            <span style={{ color: '#B3261E', fontWeight: 700 }}>still sheds</span>
          )}
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
      <div className="console-section-title">Operator Actions</div>
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
            onExecute={() => execute(action)}
          />
        ))}
      </div>
    </div>
  );
}
