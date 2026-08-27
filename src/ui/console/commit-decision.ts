/**
 * commit-decision.ts — the one way the console asks the engine to do something.
 *
 * Extracted from `OperatorActionsPanel` when a second caller appeared (the
 * inspector's corridor reclose). Every operator intent leaves the UI through
 * here as a `DecisionCommitted` on the bus, carrying the REAL tick and
 * telemetry at the moment of the decision — which is what the evidence engine
 * later measures the decision against. The UI performs no simulation logic and
 * never touches a subsystem directly.
 */
import { asDecisionId, asSeconds } from '@app-types';
import { GRID_EVENT } from '@constants';
import { useAppFlowStore, useSimulationStore } from '@state';

import type { AppRuntime } from '@infra';

/** Emit a DecisionCommitted with real tick + telemetry, and journal it. */
export function commitDecision(
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

/**
 * Decision id for an operator-requested reclose of one corridor.
 *
 * Pipe-delimited because line ids contain hyphens and the engine's other
 * handlers match by substring — `op-reclose-DT4-HB1-300` cannot be split back
 * apart reliably, `op-reclose|DT4-HB1|300` can. The engine parses this exact
 * shape in its `DecisionCommitted` handler.
 */
export function recloseDecisionId(lineId: string, tick: number): string {
  return `op-reclose|${lineId}|${String(tick)}`;
}
