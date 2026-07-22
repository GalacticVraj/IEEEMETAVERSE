import type { AppConfig } from '@config';
import { CONFIG_SERVICE, createConfigService } from '@config';
import { EVENT_BUS, LOGGER, SERIALIZER, createContainer, createToken } from '@core';
import type { Container, GridEventMap, Token, TypedEventBus } from '@core';
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
  PROTECTION_ENGINE,
  DeterministicCascadeEngine,
  GridDirector,
  MeridianBayGenerationModel,
  MeridianBayLoadModel,
  DeterministicRestorationController,
  GridSimulationEngine,
  MeridianBayTopologyService,
  DeterministicWeatherModel,
  RESTORATION_CONTROLLER,
  SIMULATION_ENGINE,
  TOPOLOGY_SERVICE,
  WEATHER_MODEL,
  createElectricalGraph,
  createProtectionEngine,
} from '@engine';
import type { ProtectionEventMap } from '@engine';
import { SCENARIO_REGISTRY, createScenarioRegistry,
  HeatwaveScenario,
  StormScenario,
  EquipmentFailureScenario,
  CyberAttackScenario,
  GeneratorLossScenario,
  SubstationFailureScenario,
  DemandSurgeScenario,
  TransformerFailureScenario,
} from '@scenarios';
import { buildScenarioFaultApi } from '@engine';

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
  LearnerTwin,
  PlaceholderLearningEngine,
  PlaceholderReferencePolicy,
  REFERENCE_POLICY,
} from '@learning';
import {
  CALIBRATION_SERVICE,
  EQUITY_ANALYZER,
  CalibrationService,
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
  // Concrete simulation engine subsystems
  container.register(TOPOLOGY_SERVICE, () => new MeridianBayTopologyService());
  container.register(WEATHER_MODEL, () => new DeterministicWeatherModel());
  container.register(GENERATION_MODEL, () => new MeridianBayGenerationModel());
  container.register(LOAD_MODEL, () => new MeridianBayLoadModel());
  // Power flow is now the real Phase-4 DC solver (`solveDcPowerFlow`), a pure
  // function invoked on the ELECTRICAL_GRAPH — no placeholder to register.
  // Real Phase-5 protection engine (relays + breakers + thermal) wired to the
  // shared kernel bus so relay/breaker/thermal events reach the frontend. It
  // still changes topology only via controlled graph transactions.
  container.register(PROTECTION_ENGINE, (c) =>
    createProtectionEngine({
      events: c.resolve(EVENT_BUS) as unknown as TypedEventBus<ProtectionEventMap>,
    }),
  );
  container.register(CASCADE_ENGINE, () => new DeterministicCascadeEngine());
  container.register(RESTORATION_CONTROLLER, (c) => new DeterministicRestorationController(
    c.resolve(TOPOLOGY_SERVICE),
    c.resolve(ELECTRICAL_GRAPH),
    c.resolve(PROTECTION_ENGINE),
    c.resolve(GENERATION_MODEL),
  ));
  container.register(DIRECTOR, () => new GridDirector());
  container.register(SIMULATION_ENGINE, (c) => new GridSimulationEngine(
    c.resolve(ELECTRICAL_GRAPH),
    c.resolve(TOPOLOGY_SERVICE),
    c.resolve(WEATHER_MODEL),
    c.resolve(GENERATION_MODEL),
    c.resolve(LOAD_MODEL),
    c.resolve(PROTECTION_ENGINE),
    c.resolve(CASCADE_ENGINE),
    c.resolve(RESTORATION_CONTROLLER),
    c.resolve(DIRECTOR),
  ));


  // ---- Scenarios (real registry, plugin instances) ----
  container.register(SCENARIO_REGISTRY, (c) => {
    const registry = createScenarioRegistry();
    const engine = c.resolve(SIMULATION_ENGINE);
    const generation = c.resolve(GENERATION_MODEL);
    const loads = c.resolve(LOAD_MODEL);
    const protection = c.resolve(PROTECTION_ENGINE);

    const faults = buildScenarioFaultApi({ engine, generation, loads, protection });

    const scenarioContext = {
      engine,
      faults,
      generation: {
        isTripped: (id: Parameters<typeof generation.isTripped>[0]) => generation.isTripped(id),
        totalOutput: () => generation.totalOutput(),
        getGeneratorOutput: (id: Parameters<typeof generation.getGeneratorOutput>[0]) =>
          generation.getGeneratorOutput(id),
      },
      loads: {
        getShedFraction: (id: Parameters<typeof loads.getShedFraction>[0]) =>
          loads.getShedFraction(id),
        totalDemand: () => loads.totalDemand(),
        getLoadDemand: (id: Parameters<typeof loads.getLoadDemand>[0]) =>
          loads.getLoadDemand(id),
      },
      protection: {
        thermalFor: (line: Parameters<typeof protection.thermalFor>[0]) =>
          protection.thermalFor(line),
        breakerFor: (line: Parameters<typeof protection.breakerFor>[0]) =>
          protection.breakerFor(line),
        relayFor: (line: Parameters<typeof protection.relayFor>[0]) =>
          protection.relayFor(line),
      },
    };

    const scenarios = [
      new HeatwaveScenario(),
      new StormScenario(),
      new EquipmentFailureScenario(),
      new CyberAttackScenario(),
      new GeneratorLossScenario(),
      new SubstationFailureScenario(),
      new DemandSurgeScenario(),
      new TransformerFailureScenario(),
    ];

    for (const scenario of scenarios) {
      scenario.setup(scenarioContext);
      registry.register(scenario);
    }

    return registry;
  });

  // ---- System B: Learning (placeholders) ----
  container.register(LEARNER_TWIN, (c) => new LearnerTwin(c.resolve(EVENT_BUS)));
  container.register(KNOWLEDGE_TRACER, () => new PlaceholderKnowledgeTracer());
  container.register(CONCEPT_GRAPH, () => new PlaceholderConceptGraph());
  container.register(REFERENCE_POLICY, () => new PlaceholderReferencePolicy());
  container.register(DECISION_SCORER, () => new PlaceholderDecisionScorer());
  container.register(ANALYTICS_COLLECTOR, () => new PlaceholderAnalyticsCollector());
  container.register(LEARNING_ENGINE, () => new PlaceholderLearningEngine());

  // ---- Ethics (placeholders) ----
  container.register(CALIBRATION_SERVICE, () => new CalibrationService());
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
