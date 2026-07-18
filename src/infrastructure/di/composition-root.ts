import type { AppConfig } from '@config';
import { CONFIG_SERVICE, createConfigService } from '@config';
import { EVENT_BUS, LOGGER, SERIALIZER, createContainer, createToken } from '@core';
import type { Container, GridEventMap, Token } from '@core';
import { createSimulationKernel } from '@kernel';
import type { SimulationKernel } from '@kernel';

/**
 * DI token for the application's concrete kernel, typed to the domain event map
 * (`GridEventMap`). It lives here in infrastructure — the only layer that may
 * know both the kernel and the domain — so the kernel itself stays
 * domain-agnostic.
 */
export const SIMULATION_KERNEL: Token<SimulationKernel<GridEventMap>> =
  createToken('SimulationKernel');

import {
  CASCADE_ENGINE,
  DIRECTOR,
  ELECTRICAL_GRAPH,
  GENERATION_MODEL,
  LOAD_MODEL,
  PROTECTION_SYSTEM,
  PlaceholderCascadeEngine,
  PlaceholderDirector,
  PlaceholderGenerationModel,
  PlaceholderLoadModel,
  PlaceholderProtectionSystem,
  PlaceholderRestorationController,
  PlaceholderSimulationEngine,
  PlaceholderTopologyService,
  PlaceholderWeatherModel,
  RESTORATION_CONTROLLER,
  SIMULATION_ENGINE,
  TOPOLOGY_SERVICE,
  WEATHER_MODEL,
  createElectricalGraph,
} from '@engine';
import { SCENARIO_REGISTRY, createScenarioRegistry, HeatwaveScenario } from '@scenarios';
import {
  ANALYTICS_COLLECTOR,
  CONCEPT_GRAPH,
  DECISION_SCORER,
  KNOWLEDGE_TRACER,
  LEARNER_TWIN,
  LEARNING_ENGINE,
  PlaceholderAnalyticsCollector,
  PlaceholderConceptGraph,
  PlaceholderDecisionScorer,
  PlaceholderKnowledgeTracer,
  PlaceholderLearnerTwin,
  PlaceholderLearningEngine,
  PlaceholderReferencePolicy,
  REFERENCE_POLICY,
} from '@learning';
import {
  CALIBRATION_SERVICE,
  EQUITY_ANALYZER,
  PlaceholderCalibrationService,
  PlaceholderEquityAnalyzer,
} from '@ethics';
import {
  PlaceholderTimeline,
  REPLAY_PLAYER,
  REPLAY_RECORDER,
  REPLAY_SERIALIZER,
  REPLAY_VERIFIER,
  SNAPSHOT_STORE,
  TIMELINE,
  createReplayPlayer,
  createReplayRecorder,
  createReplaySerializer,
  createReplayVerifier,
  createSnapshotStore,
} from '@replay';
import {
  ADAPTIVE_MUSIC,
  AMBIENT_LAYER,
  AUDIO_ENGINE,
  AUDIO_MIXER,
  PlaceholderAdaptiveMusic,
  PlaceholderAmbientLayer,
  PlaceholderAudioEngine,
  PlaceholderAudioMixer,
  PlaceholderSfxPlayer,
  SFX_PLAYER,
} from '@audio';
import { METRICS_COLLECTOR, PlaceholderMetricsCollector } from '@debug';
import { PlaceholderWorkerBridge, SIMULATION_WORKER_BRIDGE } from '@workers';

import { createConsoleLogger } from '../logging/console-logger';
import { createJsonSerializer } from '../serialization/json-serializer';

/**
 * The composition root — the ONE place that knows every concrete implementation
 * and wires it to its token. Everything else depends on interfaces + tokens
 * only. Swapping a placeholder for a real implementation in a later phase is a
 * one-line change here.
 */
export function createCompositionRoot(config: AppConfig): Container {
  const container = createContainer();

  // ---- Cross-cutting services (real) ----
  container.registerValue(CONFIG_SERVICE, createConfigService(config.profile));
  container.registerValue(LOGGER, createConsoleLogger(config.debug.logLevel));
  container.registerValue(SERIALIZER, createJsonSerializer());

  // ---- Simulation Kernel (real; it OWNS the tick-aware event bus) ----
  container.register(SIMULATION_KERNEL, (c) =>
    createSimulationKernel<GridEventMap>({
      seed: config.simulation.seed,
      frequencyHz: config.simulation.tickRateHz,
      logger: c.resolve(LOGGER),
      timeProvider: () => performance.now(),
      freezePayloads: config.kernel.freezePayloads,
      leakThreshold: config.kernel.leakThreshold,
    }),
  );
  // The shared bus IS the kernel's bus, so every event is tagged with the
  // current tick — essential for faithful replay recording.
  container.register(EVENT_BUS, (c) => c.resolve(SIMULATION_KERNEL).events);

  // ---- System A: Simulation Engine ----
  // Real: the Phase-3 electrical graph engine (authoritative topology). It is
  // tick-aware but unwired from the domain bus in Phase 3; Phase 4 will drive
  // it inside the tick and route its events onto the shared bus.
  container.register(ELECTRICAL_GRAPH, (c) =>
    createElectricalGraph({ now: () => c.resolve(SIMULATION_KERNEL).clock.tick }),
  );
  // Placeholders (Phase 4+):
  container.register(TOPOLOGY_SERVICE, () => new PlaceholderTopologyService());
  container.register(WEATHER_MODEL, () => new PlaceholderWeatherModel());
  container.register(GENERATION_MODEL, () => new PlaceholderGenerationModel());
  container.register(LOAD_MODEL, () => new PlaceholderLoadModel());
  // Power flow is now the real Phase-4 DC solver (`solveDcPowerFlow`), a pure
  // function invoked on the ELECTRICAL_GRAPH — no placeholder to register.
  container.register(PROTECTION_SYSTEM, () => new PlaceholderProtectionSystem());
  container.register(CASCADE_ENGINE, () => new PlaceholderCascadeEngine());
  container.register(RESTORATION_CONTROLLER, () => new PlaceholderRestorationController());
  container.register(DIRECTOR, () => new PlaceholderDirector());
  container.register(SIMULATION_ENGINE, () => new PlaceholderSimulationEngine());

  // ---- Scenarios (real registry, plugin instances) ----
  container.register(SCENARIO_REGISTRY, () => {
    const registry = createScenarioRegistry();
    registry.register(new HeatwaveScenario());
    return registry;
  });

  // ---- System B: Learning (placeholders) ----
  container.register(LEARNER_TWIN, () => new PlaceholderLearnerTwin());
  container.register(KNOWLEDGE_TRACER, () => new PlaceholderKnowledgeTracer());
  container.register(CONCEPT_GRAPH, () => new PlaceholderConceptGraph());
  container.register(REFERENCE_POLICY, () => new PlaceholderReferencePolicy());
  container.register(DECISION_SCORER, () => new PlaceholderDecisionScorer());
  container.register(ANALYTICS_COLLECTOR, () => new PlaceholderAnalyticsCollector());
  container.register(LEARNING_ENGINE, () => new PlaceholderLearningEngine());

  // ---- Ethics (placeholders) ----
  container.register(CALIBRATION_SERVICE, () => new PlaceholderCalibrationService());
  container.register(EQUITY_ANALYZER, () => new PlaceholderEquityAnalyzer());

  // ---- Replay (real; timeline still placeholder) ----
  container.register(REPLAY_RECORDER, () => createReplayRecorder());
  container.register(REPLAY_PLAYER, () => createReplayPlayer());
  container.register(REPLAY_SERIALIZER, (c) => createReplaySerializer(c.resolve(SERIALIZER)));
  container.register(REPLAY_VERIFIER, () => createReplayVerifier());
  container.register(TIMELINE, () => new PlaceholderTimeline());
  container.register(SNAPSHOT_STORE, () => createSnapshotStore());

  // ---- System E: Audio (placeholders) ----
  container.register(AUDIO_ENGINE, () => new PlaceholderAudioEngine());
  container.register(ADAPTIVE_MUSIC, () => new PlaceholderAdaptiveMusic());
  container.register(AMBIENT_LAYER, () => new PlaceholderAmbientLayer());
  container.register(SFX_PLAYER, () => new PlaceholderSfxPlayer());
  container.register(AUDIO_MIXER, () => new PlaceholderAudioMixer());

  // ---- Debug / Workers (placeholders) ----
  container.register(METRICS_COLLECTOR, () => new PlaceholderMetricsCollector());
  container.register(SIMULATION_WORKER_BRIDGE, () => new PlaceholderWorkerBridge());

  return container;
}
