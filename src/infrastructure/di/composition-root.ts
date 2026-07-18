import type { AppConfig } from '@config';
import { CONFIG_SERVICE, createConfigService } from '@config';
import { EVENT_BUS, LOGGER, SERIALIZER, createContainer, createEventBus } from '@core';
import type { Container, GridEventMap } from '@core';
import { SIMULATION_KERNEL, createSimulationKernel } from '@kernel';

import {
  CASCADE_ENGINE,
  DIRECTOR,
  GENERATION_MODEL,
  LOAD_MODEL,
  POWER_FLOW_SOLVER,
  PROTECTION_SYSTEM,
  PlaceholderCascadeEngine,
  PlaceholderDirector,
  PlaceholderGenerationModel,
  PlaceholderLoadModel,
  PlaceholderPowerFlowSolver,
  PlaceholderProtectionSystem,
  PlaceholderRestorationController,
  PlaceholderSimulationEngine,
  PlaceholderTopologyService,
  PlaceholderWeatherModel,
  RESTORATION_CONTROLLER,
  SIMULATION_ENGINE,
  TOPOLOGY_SERVICE,
  WEATHER_MODEL,
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
  PlaceholderReplayPlayer,
  PlaceholderReplayRecorder,
  PlaceholderReplaySerializer,
  PlaceholderReplayVerifier,
  PlaceholderSnapshotStore,
  PlaceholderTimeline,
  REPLAY_PLAYER,
  REPLAY_RECORDER,
  REPLAY_SERIALIZER,
  REPLAY_VERIFIER,
  SNAPSHOT_STORE,
  TIMELINE,
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
  container.registerValue(EVENT_BUS, createEventBus<GridEventMap>());

  // ---- Simulation Kernel (real) ----
  container.register(SIMULATION_KERNEL, (c) =>
    createSimulationKernel({
      seed: config.simulation.seed,
      timestep: config.simulation.timestep,
      events: c.resolve(EVENT_BUS),
      logger: c.resolve(LOGGER),
    }),
  );

  // ---- System A: Simulation Engine (placeholders) ----
  container.register(TOPOLOGY_SERVICE, () => new PlaceholderTopologyService());
  container.register(WEATHER_MODEL, () => new PlaceholderWeatherModel());
  container.register(GENERATION_MODEL, () => new PlaceholderGenerationModel());
  container.register(LOAD_MODEL, () => new PlaceholderLoadModel());
  container.register(POWER_FLOW_SOLVER, () => new PlaceholderPowerFlowSolver());
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

  // ---- Replay (placeholders) ----
  container.register(REPLAY_RECORDER, () => new PlaceholderReplayRecorder());
  container.register(REPLAY_PLAYER, () => new PlaceholderReplayPlayer());
  container.register(
    REPLAY_SERIALIZER,
    (c) => new PlaceholderReplaySerializer(c.resolve(SERIALIZER)),
  );
  container.register(REPLAY_VERIFIER, () => new PlaceholderReplayVerifier());
  container.register(TIMELINE, () => new PlaceholderTimeline());
  container.register(SNAPSHOT_STORE, () => new PlaceholderSnapshotStore());

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
