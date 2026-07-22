import type { AppConfig } from '@config';
import { EVENT_BUS, LOGGER } from '@core';
import type { Container, SimulationSystem } from '@core';
import { ELECTRICAL_GRAPH, SIMULATION_ENGINE, TOPOLOGY_SERVICE } from '@engine';
import { populateGraphFromTopology } from '@engine/topology/graph-builder';
import type { SimulationKernel } from '@kernel';
import type { GridEventMap } from '@core';
import { bindStores } from '@state';

import { SIMULATION_KERNEL, createCompositionRoot } from '../di/composition-root';

/** Handle to the running application runtime. */
export interface AppRuntime {
  readonly container: Container;
  readonly config: AppConfig;
  readonly kernel: SimulationKernel<GridEventMap>;
  /** Detach projections and dispose the kernel. */
  shutdown(): void;
}

/**
 * The initialization sequence. Builds the container, resolves the shared bus
 * and kernel, validates engine construction, binds event-driven projections,
 * and BOOTS the kernel so the simulation loop can start immediately.
 */
export function bootstrap(config: AppConfig): AppRuntime {
  const container = createCompositionRoot(config);
  const bus = container.resolve(EVENT_BUS);
  const logger = container.resolve(LOGGER).child('bootstrap');

  const kernel = container.resolve(SIMULATION_KERNEL);
  const engine = container.resolve(SIMULATION_ENGINE);

  // Ignition: populate the authoritative electrical graph from the static
  // topology, then register the engine as the kernel's simulation system.
  // Both MUST happen before `boot()` — registration is only legal in Boot.
  const graph = container.resolve(ELECTRICAL_GRAPH);
  const topology = container.resolve(TOPOLOGY_SERVICE).get();
  populateGraphFromTopology(graph, topology);
  kernel.register(engine as SimulationSystem<GridEventMap>);

  // Boot the kernel: Boot → Loading → Configuration → Idle
  kernel.boot();

  const unbindStores = bindStores(bus, engine);

  logger.info('GridGuard runtime bootstrapped', {
    profile: config.profile,
    seed: config.simulation.seed,
  });

  return {
    container,
    config,
    kernel,
    shutdown(): void {
      // Gracefully walk the FSM to Disposed from whatever state we're in.
      const k = kernel;
      try {
        // If Running or Paused, move to Idle first.
        if (k.state === 'Running' || k.state === 'Paused') {
          k.stop();
        }
        // From Idle (or Replay), move to Shutdown.
        if (k.state === 'Idle' || k.state === 'Replay') {
          k.shutdown();
        }
        // From Shutdown, move to Disposed.
        if (k.state === 'Shutdown') {
          k.dispose();
        }
      } catch {
        // If the FSM rejects a transition (e.g. already Disposed), that's fine.
      }
      unbindStores();
      bus.clear();
      logger.info('GridGuard runtime shut down');
    },
  };
}
