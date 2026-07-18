import type { ElectricalGraph } from '../graph';
import type { PowerFlowResult } from './results';

export type PowerFlowIssueSeverity = 'error' | 'warning';

export interface PowerFlowIssue {
  readonly code: string;
  readonly severity: PowerFlowIssueSeverity;
  readonly message: string;
  readonly island?: number;
}

export interface PowerFlowValidationReport {
  readonly valid: boolean;
  readonly issues: readonly PowerFlowIssue[];
}

const POWER_BALANCE_TOLERANCE_MW = 1e-6;

/**
 * Pre-solve check: every line must have a positive reactance (a zero/negative
 * reactance yields an infinite/invalid susceptance). Errors here mean the model
 * cannot be built — the solver refuses rather than producing garbage.
 */
export function validateSolvable(graph: ElectricalGraph): PowerFlowValidationReport {
  const issues: PowerFlowIssue[] = [];
  for (const line of graph.lines()) {
    if (!(line.reactancePu > 0)) {
      issues.push({
        code: 'INVALID_REACTANCE',
        severity: 'error',
        message: `Line ${line.id} has non-positive reactance ${line.reactancePu}`,
      });
    }
  }
  return { valid: issues.every((issue) => issue.severity !== 'error'), issues };
}

/**
 * Post-solve check: each island must have converged, be power-balanced (lossless
 * DC ⇒ generation = load within tolerance), and show a small residual. Never
 * silently ignores a failure.
 */
export function validatePowerFlowResult(
  result: PowerFlowResult,
  toleranceMw = POWER_BALANCE_TOLERANCE_MW,
): PowerFlowValidationReport {
  const issues: PowerFlowIssue[] = [];
  for (const island of result.islands) {
    if (!island.converged) {
      issues.push({
        code: 'NOT_CONVERGED',
        severity: 'error',
        message: `Island ${island.index} did not converge`,
        island: island.index,
      });
    }
    if (Math.abs(island.powerBalanceMw) > toleranceMw) {
      issues.push({
        code: 'POWER_IMBALANCE',
        severity: 'error',
        message: `Island ${island.index} power imbalance ${island.powerBalanceMw} MW`,
        island: island.index,
      });
    }
    if (island.residual > toleranceMw) {
      issues.push({
        code: 'NUMERICAL_INSTABILITY',
        severity: 'warning',
        message: `Island ${island.index} residual ${island.residual}`,
        island: island.index,
      });
    }
  }
  return { valid: issues.every((issue) => issue.severity !== 'error'), issues };
}
