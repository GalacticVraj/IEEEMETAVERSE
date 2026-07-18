import { SimulationState } from '@app-types';
import { InvalidStateTransitionError } from '@core';
import type { Unsubscribe } from '@core';

import { SIMULATION_TRANSITIONS } from './transitions';

/** A single observed state change. */
export interface StateChange {
  readonly from: SimulationState;
  readonly to: SimulationState;
}

export type StateChangeListener = (change: StateChange) => void;

/**
 * The formal simulation lifecycle state machine. Pure and framework-free: it
 * validates transitions against {@link SIMULATION_TRANSITIONS} and notifies
 * listeners. It does NOT touch the event bus — the kernel bridges state changes
 * onto `SimStateChanged` so the FSM stays independently testable.
 */
export interface SimulationStateMachine {
  readonly state: SimulationState;
  /** Whether a transition to `target` is currently legal. */
  can(target: SimulationState): boolean;
  /** Transition to `target`, or throw {@link InvalidStateTransitionError}. */
  transition(target: SimulationState): void;
  /** Observe state changes. Returns an unsubscribe function. */
  onChange(listener: StateChangeListener): Unsubscribe;
  /** Force back to `Boot` without validation (used by a full reset). */
  reset(): void;
}

export function createSimulationStateMachine(
  initial: SimulationState = SimulationState.Boot,
): SimulationStateMachine {
  let current = initial;
  const listeners = new Set<StateChangeListener>();

  const notify = (change: StateChange): void => {
    for (const listener of [...listeners]) {
      listener(change);
    }
  };

  const can = (target: SimulationState): boolean =>
    SIMULATION_TRANSITIONS[current].includes(target);

  return {
    get state(): SimulationState {
      return current;
    },
    can,
    transition(target: SimulationState): void {
      if (!can(target)) {
        throw new InvalidStateTransitionError(current, target);
      }
      const change: StateChange = { from: current, to: target };
      current = target;
      notify(change);
    },
    onChange(listener: StateChangeListener): Unsubscribe {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reset(): void {
      if (current === SimulationState.Boot) return;
      const change: StateChange = { from: current, to: SimulationState.Boot };
      current = SimulationState.Boot;
      notify(change);
    },
  };
}
