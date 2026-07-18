import { KernelState } from '@app-types';
import { InvalidStateTransitionError } from '@core';
import { describe, expect, it, vi } from 'vitest';

import { createKernelLifecycle } from './kernel-lifecycle';

describe('KernelLifecycle', () => {
  it('starts in Boot', () => {
    expect(createKernelLifecycle().state).toBe(KernelState.Boot);
  });

  it('performs a legal transition', () => {
    const fsm = createKernelLifecycle();
    fsm.transition(KernelState.Loading);
    expect(fsm.state).toBe(KernelState.Loading);
  });

  it('throws a descriptive error on an illegal transition and does not change state', () => {
    const fsm = createKernelLifecycle();
    expect(() => {
      fsm.transition(KernelState.Running);
    }).toThrow(InvalidStateTransitionError);
    expect(fsm.state).toBe(KernelState.Boot);
  });

  it('walks the full runtime lifecycle to Disposed', () => {
    const fsm = createKernelLifecycle();
    const path = [
      KernelState.Loading,
      KernelState.Configuration,
      KernelState.RegisterSystems,
      KernelState.Calibration,
      KernelState.Idle,
      KernelState.Running,
      KernelState.Paused,
      KernelState.Replay,
      KernelState.Shutdown,
      KernelState.Disposed,
    ];
    for (const next of path) {
      fsm.transition(next);
    }
    expect(fsm.state).toBe(KernelState.Disposed);
  });

  it('treats Disposed as terminal', () => {
    const fsm = createKernelLifecycle(KernelState.Disposed);
    expect(fsm.can(KernelState.Boot)).toBe(false);
    expect(fsm.can(KernelState.Idle)).toBe(false);
  });

  it('can() reflects the transition table', () => {
    const fsm = createKernelLifecycle(KernelState.Idle);
    expect(fsm.can(KernelState.Running)).toBe(true);
    expect(fsm.can(KernelState.Configuration)).toBe(false);
  });

  it('notifies listeners and supports unsubscribe', () => {
    const fsm = createKernelLifecycle();
    const listener = vi.fn();
    const off = fsm.onChange(listener);
    fsm.transition(KernelState.Loading);
    expect(listener).toHaveBeenCalledWith({
      from: KernelState.Boot,
      to: KernelState.Loading,
    });
    off();
    fsm.transition(KernelState.Configuration);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
