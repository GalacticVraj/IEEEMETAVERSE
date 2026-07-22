import type { BusId } from '@app-types';
import type { AppConfig } from '@config';
import { EVENT_BUS, LOGGER } from '@core';
import type { Container, SimulationSystem } from '@core';
import { ELECTRICAL_GRAPH, PROTECTION_ENGINE, SIMULATION_ENGINE, TOPOLOGY_SERVICE } from '@engine';
import { populateGraphFromTopology } from '@engine/topology/graph-builder';
import type { SimulationKernel } from '@kernel';
import type { GridEventMap } from '@core';
import { EVIDENCE_ENGINE, LEARNER_TWIN } from '@learning';
import { SCENARIO_REGISTRY } from '@scenarios';
import { bindStores, pushEvidenceFeedback, pushRunOpener } from '@state';

import { SCENARIO_CONTEXT, SIMULATION_KERNEL, createCompositionRoot } from '../di/composition-root';
import { createCrisisSession } from '../runtime/crisis-session';
import type { CrisisSession } from '../runtime/crisis-session';

/** Handle to the running application runtime. */
export interface AppRuntime {
  readonly container: Container;
  readonly config: AppConfig;
  readonly kernel: SimulationKernel<GridEventMap>;
  /** The one real-time driver: starts/stops scenario runs and kernel ticking. */
  readonly session: CrisisSession;
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
  kernel.register(engine as unknown as SimulationSystem<GridEventMap>);

  // Boot the kernel: Boot → Loading → Configuration → Idle
  kernel.boot();

  const unbindStores = bindStores(bus, engine);

  // Learning intelligence: measure decisions against real telemetry and feed
  // the Learner Twin (evidence-based mastery). Finalized records also surface
  // as in-play advisor feedback with the real before/after numbers.
  const evidenceEngine = container.resolve(EVIDENCE_ENGINE);
  evidenceEngine.start();
  const unbindEvidenceFeedback = evidenceEngine.onRecord((record) => {
    pushEvidenceFeedback(record, performance.now());
  });

  // Mentor memory: when a NEW run starts and the twin has history, open with
  // a personalized, evidence-grounded note (attempt, blackouts, weak concept).
  const twin = container.resolve(LEARNER_TWIN);
  const unbindRunOpener = bus.on(GRID_EVENT.KernelStateChanged, (payload) => {
    if (payload.from === 'Idle' && payload.to === 'Running') {
      pushRunOpener(twin.state(), performance.now());
    }
  });

  const session = createCrisisSession({
    kernel,
    registry: () => container.resolve(SCENARIO_REGISTRY),
    prepareScenario: (scenario) => {
      // Heal the grid from the previous run: protection removes tripped lines
      // from the graph via controlled transactions, so a restart must re-add
      // anything still missing and walk open breakers back toward Closed.
      const protection = container.resolve(PROTECTION_ENGINE);
      const missing = topology.lines.filter((line) => graph.getLine(line.id) === undefined);
      if (missing.length > 0) {
        graph.mutate((tx) => {
          for (const line of missing) {
            tx.addLine({
              id: line.id,
              from: line.from as unknown as BusId,
              to: line.to as unknown as BusId,
              capacityMw: line.capacity,
              reactancePu: line.reactance,
            });
          }
        });
      }
      for (const line of topology.lines) {
        protection.resetRelay(line.id);
        const breaker = protection.breakerFor(line.id);
        if (breaker !== undefined && breaker.phase === 'Open') {
          protection.commandClose(line.id, 0);
        }
      }
      protection.register(graph);

      // Re-arm the scenario's scripted faults for a fresh run.
      scenario.setup(container.resolve(SCENARIO_CONTEXT));
    },
  });

  logger.info('GridGuard runtime bootstrapped', {
    profile: config.profile,
    seed: config.simulation.seed,
  });

  return {
    container,
    config,
    kernel,
    session,
    shutdown(): void {
      unbindRunOpener();
      unbindEvidenceFeedback();
      evidenceEngine.stop();
      session.stop();
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
