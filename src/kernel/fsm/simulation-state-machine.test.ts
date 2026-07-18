import { SimulationState } from '@app-types';
import { InvalidStateTransitionError } from '@core';
import { describe, expect, it, vi } from 'vitest';

import { createSimulationStateMachine } from './simulation-state-machine';

describe('SimulationStateMachine', () => {
  it('starts in Boot', () => {
    expect(createSimulationStateMachine().state).toBe(SimulationState.Boot);
  });

  it('performs a legal transition', () => {
    const fsm = createSimulationStateMachine();
    fsm.transition(SimulationState.Loading);
    expect(fsm.state).toBe(SimulationState.Loading);
  });

  it('rejects an illegal transition', () => {
    const fsm = createSimulationStateMachine();
    expect(() => {
      fsm.transition(SimulationState.Crisis);
    }).toThrow(InvalidStateTransitionError);
    expect(fsm.state).toBe(SimulationState.Boot);
  });

  it('walks the full lifecycle happy path back to Boot', () => {
    const fsm = createSimulationStateMachine();
    const path = [
      SimulationState.Loading,
      SimulationState.Calibration,
      SimulationState.Idle,
      SimulationState.PreCrisis,
      SimulationState.Crisis,
      SimulationState.Cascade,
      SimulationState.Recovery,
      SimulationState.AfterAction,
      SimulationState.Replay,
      SimulationState.Reset,
      SimulationState.Boot,
    ];
    for (const next of path) {
      fsm.transition(next);
    }
    expect(fsm.state).toBe(SimulationState.Boot);
  });

  it('can() reflects the transition table', () => {
    const fsm = createSimulationStateMachine();
    expect(fsm.can(SimulationState.Loading)).toBe(true);
    expect(fsm.can(SimulationState.Crisis)).toBe(false);
  });

  it('notifies listeners and supports unsubscribe', () => {
    const fsm = createSimulationStateMachine();
    const listener = vi.fn();
    const off = fsm.onChange(listener);
    fsm.transition(SimulationState.Loading);
    expect(listener).toHaveBeenCalledWith({
      from: SimulationState.Boot,
      to: SimulationState.Loading,
    });
    off();
    fsm.transition(SimulationState.Calibration);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reset returns to Boot from any later state', () => {
    const fsm = createSimulationStateMachine();
    fsm.transition(SimulationState.Loading);
    fsm.reset();
    expect(fsm.state).toBe(SimulationState.Boot);
  });
});
