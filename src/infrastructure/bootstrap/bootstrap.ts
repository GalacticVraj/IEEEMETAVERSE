import type { AppConfig } from '@config';
import { EVENT_BUS, LOGGER } from '@core';
import type { Container } from '@core';
import { SIMULATION_ENGINE } from '@engine';
import { SIMULATION_KERNEL } from '@kernel';
import { bindStores } from '@state';

import { createCompositionRoot } from '../di/composition-root';

/** Handle to the running application runtime. */
export interface AppRuntime {
  readonly container: Container;
  readonly config: AppConfig;
  /** Detach projections and dispose the kernel. */
  shutdown(): void;
}

/**
 * The initialization sequence. Builds the container, resolves the shared bus and
 * kernel, validates engine construction, and binds event-driven projections.
 *
 * Phase 1 deliberately does NOT `kernel.boot()`/`tick()`: the engine is a
 * placeholder. The runtime exists to prove the wiring end-to-end; the simulation
 * loop starts in Phase 2. See docs/architecture/14-initialization-sequence.md.
 */
export function bootstrap(config: AppConfig): AppRuntime {
  const container = createCompositionRoot(config);
  const bus = container.resolve(EVENT_BUS);
  const kernel = container.resolve(SIMULATION_KERNEL);
  const logger = container.resolve(LOGGER).child('bootstrap');

  // Eagerly construct the engine to validate DI wiring. It is not registered as
  // a kernel system yet — its lifecycle is a placeholder. Phase 2 registers it.
  container.resolve(SIMULATION_ENGINE);

  const unbindStores = bindStores(bus);

  logger.info('GridGuard runtime bootstrapped', {
    profile: config.profile,
    seed: config.simulation.seed,
  });

  return {
    container,
    config,
    shutdown(): void {
      unbindStores();
      kernel.dispose();
      logger.info('GridGuard runtime shut down');
    },
  };
}
