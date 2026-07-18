import { asSystemId } from '@app-types';
import type { SystemId } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { SimulationSystem, SystemContext, TickContext, Token } from '@core';

import type { GridState } from './model/grid';

/**
 * The Simulation Engine facade — System A's single entry point and the one
 * `SimulationSystem` registered with the kernel. It owns the authoritative
 * `GridState` and, each tick, orchestrates its subsystems in physical order:
 *
 *   weather → generation → load → power flow → protection → cascade →
 *   restoration → director
 *
 * Everything it computes is published as events; nothing outside the engine may
 * mutate its state.
 */
export interface ISimulationEngine extends SimulationSystem {
  /** Authoritative snapshot of the live grid. */
  getState(): GridState;
}

export const SIMULATION_ENGINE: Token<ISimulationEngine> = createToken('SimulationEngine');

/**
 * Placeholder simulation engine. Registered by the composition root so the full
 * wiring exists in Phase 1, but it does not run — every method documents the
 * behavior its phase will implement and throws `NotImplementedError` if called.
 */
export class PlaceholderSimulationEngine implements ISimulationEngine {
  public readonly id: SystemId = asSystemId('simulation-engine');

  public init(context: SystemContext): void {
    notImplemented(
      'SimulationEngine.init',
      'Resolve subsystems, build topology from the scenario, seed initial GridState.',
      { context },
    );
  }

  public step(context: TickContext): void {
    notImplemented(
      'SimulationEngine.step',
      'Advance one tick: weather → generation → load → power flow → protection → cascade → restoration → director, emitting events throughout.',
      { context },
    );
  }

  public reset(): void {
    notImplemented(
      'SimulationEngine.reset',
      'Rebuild initial grid state without disposing subsystems.',
    );
  }

  public dispose(): void {
    notImplemented('SimulationEngine.dispose', 'Release subsystem resources and clear state.');
  }

  public getState(): GridState {
    return notImplemented(
      'SimulationEngine.getState',
      'Return the authoritative grid-state snapshot for projection into stores.',
    );
  }
}
