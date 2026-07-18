import type { KernelState, Seconds } from '@app-types';

/**
 * The events the SIMULATION KERNEL itself owns and emits. Domain-agnostic: a
 * tick and a runtime-lifecycle change — nothing about electrical grids or
 * gameplay. A domain event map (e.g. `GridEventMap`) EXTENDS this one, so the
 * kernel references only `KernelEventMap` and never the domain's event names.
 */

export interface SimulationTickPayload {
  readonly tick: number;
  readonly simTime: Seconds;
  readonly timestep: Seconds;
}

/**
 * Emitted by the kernel when its runtime lifecycle changes. `KernelState`
 * describes how the runtime is executing, not any gameplay arc.
 */
export interface KernelStateChangedPayload {
  readonly from: KernelState;
  readonly to: KernelState;
  readonly tick: number;
}

export interface KernelEventMap {
  SimulationTick: SimulationTickPayload;
  KernelStateChanged: KernelStateChangedPayload;
}

/** Canonical kernel event names (no anonymous event strings). */
export const KERNEL_EVENT = {
  SimulationTick: 'SimulationTick',
  KernelStateChanged: 'KernelStateChanged',
} as const;

export type KernelEventName = (typeof KERNEL_EVENT)[keyof typeof KERNEL_EVENT];
