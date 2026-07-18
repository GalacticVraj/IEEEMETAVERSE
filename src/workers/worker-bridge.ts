import { createToken, notImplemented } from '@core';
import type { Token, Unsubscribe } from '@core';

import type { WorkerRequest, WorkerResponse } from './messages';

/**
 * Abstraction over "where the simulation runs". Phase 1 resolves to a
 * main-thread implementation; a later phase can swap in a real web-worker
 * bridge with zero changes to consumers.
 */
export interface ISimulationWorkerBridge {
  post(request: WorkerRequest): void;
  onMessage(handler: (response: WorkerResponse) => void): Unsubscribe;
  dispose(): void;
}

export const SIMULATION_WORKER_BRIDGE: Token<ISimulationWorkerBridge> =
  createToken('SimulationWorkerBridge');

/**
 * Placeholder bridge.
 *
 * A later phase will offload the kernel to `simulation.worker.ts` for a smooth
 * frame budget under heavy cascades. Until then the simulation runs on the main
 * thread and this bridge is unused.
 */
export class PlaceholderWorkerBridge implements ISimulationWorkerBridge {
  public post(request: WorkerRequest): void {
    notImplemented('SimulationWorkerBridge.post', 'Forward a request to the simulation worker.', {
      request,
    });
  }

  public onMessage(handler: (response: WorkerResponse) => void): Unsubscribe {
    return notImplemented('SimulationWorkerBridge.onMessage', 'Subscribe to worker responses.', {
      handler,
    });
  }

  public dispose(): void {
    notImplemented('SimulationWorkerBridge.dispose', 'Terminate the worker.');
  }
}
