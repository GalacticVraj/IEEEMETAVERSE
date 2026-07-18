import type { BusId } from '@app-types';
import type { KernelEventMap } from '@core';

/*
 * Power-flow events. `PowerFlowEventMap` EXTENDS `KernelEventMap`, so these flow
 * on any kernel-compatible bus while the kernel never references them. The
 * solver emits a deterministic sequence per solve. Every payload is documented.
 */

/** A solve began over the current topology. */
export interface PowerFlowStartedPayload {
  readonly topologyHash: string;
  readonly islandCount: number;
}

/** A slack bus was selected for an island. */
export interface SlackBusSelectedPayload {
  readonly island: number;
  readonly bus: BusId;
  readonly reason: 'configured' | 'generator-priority' | 'fallback';
}

/** One island finished solving. */
export interface IslandSolvedPayload {
  readonly island: number;
  readonly converged: boolean;
  readonly slackGenerationMw: number;
  readonly residual: number;
}

/** Aggregate power balance across all islands. */
export interface PowerBalanceComputedPayload {
  readonly totalGenerationMw: number;
  readonly totalLoadMw: number;
  readonly balanceMw: number;
}

/** All islands solved successfully. */
export interface PowerFlowSolvedPayload {
  readonly converged: boolean;
  readonly maxLoading: number;
  readonly maxResidual: number;
  readonly executionMs: number;
}

/** A solve failed (singular matrix, invalid reactance, …). */
export interface SolverFailedPayload {
  readonly island: number | null;
  readonly reason: string;
}

export interface PowerFlowEventMap extends KernelEventMap {
  PowerFlowStarted: PowerFlowStartedPayload;
  SlackBusSelected: SlackBusSelectedPayload;
  IslandSolved: IslandSolvedPayload;
  PowerBalanceComputed: PowerBalanceComputedPayload;
  PowerFlowSolved: PowerFlowSolvedPayload;
  SolverFailed: SolverFailedPayload;
}

export const POWER_FLOW_EVENT = {
  PowerFlowStarted: 'PowerFlowStarted',
  SlackBusSelected: 'SlackBusSelected',
  IslandSolved: 'IslandSolved',
  PowerBalanceComputed: 'PowerBalanceComputed',
  PowerFlowSolved: 'PowerFlowSolved',
  SolverFailed: 'SolverFailed',
} as const;

export type PowerFlowEventName = (typeof POWER_FLOW_EVENT)[keyof typeof POWER_FLOW_EVENT];
