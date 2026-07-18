import { KernelState } from '@app-types';
import { InvalidStateTransitionError } from '@core';
import type { Unsubscribe } from '@core';

import { KERNEL_TRANSITIONS } from './kernel-transitions';

export interface KernelStateChange {
  readonly from: KernelState;
  readonly to: KernelState;
}

export type KernelStateListener = (change: KernelStateChange) => void;

/**
 * The kernel runtime lifecycle state machine. Pure and domain-agnostic: it
 * validates transitions against {@link KERNEL_TRANSITIONS} and notifies
 * listeners. Illegal transitions throw {@link InvalidStateTransitionError} with
 * the exact from→to pair. The kernel bridges these changes onto the event bus.
 */
export interface KernelLifecycle {
  readonly state: KernelState;
  /** Whether a transition to `target` is currently legal. */
  can(target: KernelState): boolean;
  /** Transition to `target`, or throw with a descriptive error. */
  transition(target: KernelState): void;
  /** Observe state changes. Returns an unsubscribe function. */
  onChange(listener: KernelStateListener): Unsubscribe;
}

export function createKernelLifecycle(initial: KernelState = KernelState.Boot): KernelLifecycle {
  let current = initial;
  const listeners = new Set<KernelStateListener>();

  const can = (target: KernelState): boolean => KERNEL_TRANSITIONS[current].includes(target);

  return {
    get state(): KernelState {
      return current;
    },
    can,
    transition(target: KernelState): void {
      if (!can(target)) {
        throw new InvalidStateTransitionError(current, target);
      }
      const change: KernelStateChange = { from: current, to: target };
      current = target;
      for (const listener of [...listeners]) {
        listener(change);
      }
    },
    onChange(listener: KernelStateListener): Unsubscribe {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
