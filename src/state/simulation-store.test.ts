import { beforeEach, describe, expect, it } from 'vitest';
import { useSimulationStore, bindSimulationStore } from './simulation-store';
import { KernelState } from '@app-types';
import { GRID_EVENT } from '@constants';

// We mock an event bus to trigger the projection store's updates
class MockEventBus {
  listeners: Record<string, ((payload: any) => void)[]> = {};

  on(event: string, callback: (payload: any) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(callback);
    return () => {
      this.listeners[event] = this.listeners[event]!.filter(cb => cb !== callback);
    };
  }

  emit(event: string, payload?: any) {
    if (this.listeners[event]) {
      for (const cb of this.listeners[event]) {
        cb(payload);
      }
    }
  }
}

describe('simulation-store', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test. 
    // The `true` parameter forces a replace instead of a merge, guaranteeing clean state.
    useSimulationStore.setState({
      tick: 0,
      simTime: 0,
      lifecycle: KernelState.Boot,
      maxLineLoading: 0,
      activeDecision: null,
    }, true);
  });

  it('Initial state shape matches the defined TypeScript interface', () => {
    const state = useSimulationStore.getState();
    expect(state).toEqual({
      tick: 0,
      simTime: 0,
      lifecycle: KernelState.Boot,
      maxLineLoading: 0,
      activeDecision: null,
    });
  });

  describe('State mutation via Event Bus bindings (actions)', () => {
    let bus: MockEventBus;
    let unsub: () => void;

    beforeEach(() => {
      bus = new MockEventBus();
      unsub = bindSimulationStore(bus as any);
    });

    it('SimulationTick mutates only the intended slice of state', () => {
      bus.emit(GRID_EVENT.SimulationTick, { tick: 42, simTime: 4.2 });
      
      const state = useSimulationStore.getState();
      expect(state.tick).toBe(42);
      expect(state.simTime).toBe(4.2);
      
      // Verify no unintended side effects on sibling keys
      expect(state.lifecycle).toBe(KernelState.Boot);
      expect(state.maxLineLoading).toBe(0);
      expect(state.activeDecision).toBeNull();
    });

    it('KernelStateChanged mutates only the intended slice of state', () => {
      bus.emit(GRID_EVENT.KernelStateChanged, { from: KernelState.Boot, to: KernelState.Running });
      
      const state = useSimulationStore.getState();
      expect(state.lifecycle).toBe(KernelState.Running);
      
      // Verify no unintended side effects on sibling keys
      expect(state.tick).toBe(0);
      expect(state.maxLineLoading).toBe(0);
    });

    it('PowerFlowSolved mutates only the intended slice of state', () => {
      bus.emit(GRID_EVENT.PowerFlowSolved, { maxLoading: 0.95 });
      
      const state = useSimulationStore.getState();
      expect(state.maxLineLoading).toBe(0.95);
      
      // Verify no unintended side effects on sibling keys
      expect(state.tick).toBe(0);
      expect(state.lifecycle).toBe(KernelState.Boot);
    });

    it('DecisionRequested and DecisionCommitted mutate only the activeDecision slice', () => {
      const decisionPayload = { id: 'dec-1', options: [] };
      
      bus.emit(GRID_EVENT.DecisionRequested, decisionPayload);
      let state = useSimulationStore.getState();
      expect(state.activeDecision).toBe(decisionPayload);
      // Verify no unintended side effects on sibling keys
      expect(state.tick).toBe(0);
      
      bus.emit(GRID_EVENT.DecisionCommitted, { id: 'dec-1', option: 0 });
      state = useSimulationStore.getState();
      expect(state.activeDecision).toBeNull();
      // Verify no unintended side effects on sibling keys
      expect(state.tick).toBe(0); 
    });

    it('Unsubscribe successfully detaches listeners', () => {
      unsub();
      // Emitting should have no effect now
      bus.emit(GRID_EVENT.SimulationTick, { tick: 100, simTime: 10 });
      expect(useSimulationStore.getState().tick).toBe(0);
    });
  });
});
