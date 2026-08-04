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
import { useAppFlowStore, useGridStore, useSimulationStore } from '@state';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import type { AppRuntime } from '@infra';

import { useRuntime } from '../../runtime-context';
import { Tooltip } from '../common/Tooltip';
import { simClock } from './learning-copy';
import { OPERATOR_ACTIONS } from './operator-actions';
import type { OperatorAction } from './operator-actions';
import { PanelHeader } from './PanelHeader';

function ZapIcon(): ReactElement {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
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
      className="animate-scale-in"
      style={{
        border: '1.5px solid #B4531F',
        borderRadius: 8,
        padding: '10px 12px',
        background: 'rgba(180, 83, 31, 0.08)',
        marginBottom: 8,
      }}
    >
      <div
        className="console-section-title"
        style={{ color: '#B4531F', marginBottom: 4, fontSize: 11, fontWeight: 700 }}
      >
        ⚡ URGENT DECISION REQUIRED
      </div>
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.45,
          color: '#1C2530',
          marginBottom: 8,
          fontWeight: 500,
        }}
      >
        {activeDecision.prompt}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {activeDecision.options.map((option, index) => (
          <Tooltip
            key={option}
            title="Commit Urgent Decision"
            content={`Commits "${option}" to address the crisis prompt. Impact is measured in After-Action review.`}
            position="top"
          >
            <button
              className="console-btn-primary"
              style={{
                textAlign: 'left',
                fontSize: 11.5,
                justifyContent: 'flex-start',
                width: '100%',
              }}
              onClick={() => commitDecision(runtime, activeDecision.decisionId, index, option)}
            >
              {option}
            </button>
          </Tooltip>
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
    <div style={{ borderBottom: '1px solid rgba(231, 233, 230, 0.7)', padding: '8px 0' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: committed ? '#8B97A3' : '#1C2530' }}>
          {action.label}
        </span>
        {committed ? (
          <span
            className="console-value"
            style={{
              fontSize: 10,
              color: '#217A56',
              whiteSpace: 'nowrap',
              fontWeight: 600,
              background: 'rgba(33, 122, 86, 0.1)',
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            COMMITTED · {simClock(committedAtTick)}
          </span>
        ) : (
          <Tooltip
            title={`Execute ${action.label}`}
            content={`Dispatches "${action.plainEffect}" intervention to the grid.`}
            position="top"
          >
            <button
              className="console-btn"
              style={{ padding: '4px 12px', fontSize: 11, minHeight: 28 }}
              onClick={onExecute}
            >
              Execute
            </button>
          </Tooltip>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: '#5A6774', marginTop: 3 }}>{action.plainEffect}</div>
      <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 10, color: '#8B97A3' }}>
        <span>
          Cost: <strong style={{ color: '#5A6774' }}>{action.cost}</strong>
        </span>
        <span style={{ color: '#217A56' }}>
          Benefit: <strong>{action.benefit}</strong>
        </span>
        <span style={{ color: '#9A6B15' }}>
          Risk: <strong>{action.risk}</strong>
        </span>
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
      className="console-panel animate-slide-in-left"
      style={{
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <PanelHeader title="DECISION" subtitle="Available operator interventions to stabilize network" icon={<ZapIcon />} />
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
