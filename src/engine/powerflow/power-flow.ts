import type { PerUnit } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

import type { GenerationDispatch } from '../generation/generation';
import type { ZoneDemand } from '../loads/loads';
import type { GridTopology, LineFlow } from '../model/grid';

export interface PowerFlowResult {
  readonly converged: boolean;
  readonly iterations: number;
  /** Highest per-unit line loading in the solution. */
  readonly maxLoading: PerUnit;
  readonly flows: readonly LineFlow[];
}

/** Solves steady-state power flow given topology, generation, and demand. */
export interface IPowerFlowSolver {
  solve(
    topology: GridTopology,
    generation: readonly GenerationDispatch[],
    demand: readonly ZoneDemand[],
  ): PowerFlowResult;
}

export const POWER_FLOW_SOLVER: Token<IPowerFlowSolver> = createToken('PowerFlowSolver');

/**
 * Placeholder power-flow solver.
 *
 * PHASE 2 will implement a DC power-flow approximation first (fast, always
 * convergent, good enough to drive line loadings and the cascade), with an
 * optional Newton-Raphson AC refinement later. Emits `PowerFlowSolved` and,
 * per overloaded line, `LineOverloaded`.
 */
export class PlaceholderPowerFlowSolver implements IPowerFlowSolver {
  public solve(
    topology: GridTopology,
    generation: readonly GenerationDispatch[],
    demand: readonly ZoneDemand[],
  ): PowerFlowResult {
    return notImplemented(
      'PowerFlowSolver.solve',
      'DC power-flow solve producing per-line flows, loadings, and max loading.',
      { topology, generation, demand },
    );
  }
}
