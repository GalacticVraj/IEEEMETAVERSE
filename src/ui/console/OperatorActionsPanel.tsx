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
import {
  useAppFlowStore,
  useGridStore,
  useSimulationStore,
} from '@state';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import type { AppRuntime } from '@infra';

import { useRuntime } from '../../runtime-context';

import { simClock } from './learning-copy';
import { OPERATOR_ACTIONS } from './operator-actions';
import type { OperatorAction } from './operator-actions';

/** Emit a DecisionCommitted with REAL tick + telemetry, and journal it. */
function commitDecision(
  runtime: AppRuntime,
  decisionId: string,
  optionIndex: number,
  label: string,
): void {
  const { tick, simTime, maxLineLoading } = useSimulationStore.getState();
  (runtime.kernel.events as { emit(n: string, p: unknown): void }).emit(GRID_EVENT.DecisionCommitted, {
    decisionId: asDecisionId(decisionId),
    optionIndex,
    simTime: asSeconds(simTime),
  });
  useAppFlowStore.getState().logDecision({
    tick,
    action: { type: decisionId, label },
    zoneId: 'grid',
    zoneIncomeTier: null,
    alternativesConsidered: [
      { action: { type: 'no-action', label: 'Do nothing' }, projectedMaxLineLoading: maxLineLoading },
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
  onExecute,
}: {
  action: OperatorAction;
  committedAtTick: number | undefined;
  onExecute: () => void;
}): ReactElement {
  const committed = committedAtTick !== undefined;
  return (
    <div style={{ borderBottom: '1px solid #E7E9E6', padding: '7px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: committed ? '#8B97A3' : '#1C2530' }}>
          {action.label}
        </span>
        {committed ? (
          <span className="console-value" style={{ fontSize: 10, color: '#217A56', whiteSpace: 'nowrap' }}>
            COMMITTED · {simClock(committedAtTick)}
          </span>
        ) : (
          <button className="console-btn" style={{ padding: '3px 10px', fontSize: 11 }} onClick={onExecute}>
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
    </div>
  );
}

export function OperatorActionsPanel(): ReactElement {
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
      style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}
    >
      <div className="console-section-title">Operator Actions</div>
      <DirectorPrompt />
      <div>
        {OPERATOR_ACTIONS.map((action) => (
          <ActionRow
            key={action.id}
            action={action}
            committedAtTick={committed[action.id]}
            onExecute={() => execute(action)}
          />
        ))}
      </div>
    </div>
  );
}
