import { asDecisionId, asScenarioId, asSeconds } from '@app-types';
import { PROFILES } from '@config';
import { EVENT_BUS, LOGGER, SERIALIZER } from '@core';
import { LOAD_MODEL, SIMULATION_ENGINE } from '@engine';
import { SCENARIO_REGISTRY } from '@scenarios';
import { describe, expect, it } from 'vitest';

import { SIMULATION_KERNEL } from '../di/composition-root';
import { bootstrap } from './bootstrap';

/** Expected scenario IDs — one for each concrete scenario class. */
const EXPECTED_SCENARIO_IDS = [
  'heatwave',
  'storm',
  'equipment-failure',
  'cyber-attack',
  'generator-loss',
  'substation-failure',
  'demand-surge',
  'transformer-failure',
] as const;

/**
 * Integration smoke test: exercises the ENTIRE composition root and bootstrap
 * sequence at runtime. If any token is misregistered or any wiring is broken,
 * this fails — a stronger guarantee than the build alone.
 */
describe('bootstrap', () => {
  it('wires the full runtime and resolves core services', () => {
    const runtime = bootstrap(PROFILES.development);
    const { container } = runtime;

    expect(container.has(EVENT_BUS)).toBe(true);
    expect(container.resolve(SIMULATION_KERNEL)).toBeDefined();
    expect(container.resolve(SIMULATION_ENGINE)).toBeDefined();
    expect(container.resolve(LOGGER)).toBeDefined();
    expect(container.resolve(SERIALIZER)).toBeDefined();

    runtime.shutdown();
  });

  it('registers all 8 scenarios in the registry', () => {
    const runtime = bootstrap(PROFILES.development);
    const registry = runtime.container.resolve(SCENARIO_REGISTRY);

    expect(registry.all()).toHaveLength(EXPECTED_SCENARIO_IDS.length);

    for (const id of EXPECTED_SCENARIO_IDS) {
      expect(registry.has(asScenarioId(id)), `scenario "${id}" should be registered`).toBe(true);
    }

    runtime.shutdown();
  });

  it('each registered scenario has valid metadata', () => {
    const runtime = bootstrap(PROFILES.development);
    const registry = runtime.container.resolve(SCENARIO_REGISTRY);

    for (const scenario of registry.all()) {
      expect(scenario.metadata.id).toBeTruthy();
      expect(scenario.metadata.name).toBeTruthy();
      expect(scenario.metadata.summary).toBeTruthy();
      expect(scenario.metadata.difficulty).toBeTruthy();
    }

    runtime.shutdown();
  });

  it('shuts down cleanly without throwing', () => {
    const runtime = bootstrap(PROFILES.competition);
    expect(() => {
      runtime.shutdown();
    }).not.toThrow();
  });

  it('ignites the simulation — graph populated, engine registered, physics ticking', () => {
    const runtime = bootstrap(PROFILES.development);
    const kernel = runtime.container.resolve(SIMULATION_KERNEL);
    const engine = runtime.container.resolve(SIMULATION_ENGINE);

    kernel.start();
    kernel.tick();

    const state = engine.getState();
    expect(state.lines).toHaveLength(30);
    expect(state.totalGeneration).toBeGreaterThan(0);
    expect(state.totalLoad).toBeGreaterThan(0);
    expect(state.zones).toHaveLength(6);

    runtime.shutdown();
  });

  it('maps standing operator actions (op-*) to real load interventions', () => {
    const runtime = bootstrap(PROFILES.development);
    const bus = runtime.container.resolve(EVENT_BUS);
    const loads = runtime.container.resolve(LOAD_MODEL);

    // Residential AC on in the baseline
    const rnHouse = loads.getBuildingAppliances().find((b) => b.buildingId.startsWith('RN-House'));
    expect(rnHouse?.appliances.find((a) => a.id === 'ac')?.isOn).toBe(true);

    bus.emit('DecisionCommitted', {
      decisionId: asDecisionId('op-ac-residential-42'),
      optionIndex: 0,
      simTime: asSeconds(4.2),
    });
    expect(rnHouse?.appliances.find((a) => a.id === 'ac')?.isOn).toBe(false);

    bus.emit('DecisionCommitted', {
      decisionId: asDecisionId('op-shed-industrial-42'),
      optionIndex: 0,
      simTime: asSeconds(4.2),
    });
    expect(loads.getShedFraction('LD-IN-HVY' as never)).toBeCloseTo(0.3);
    expect(loads.getShedFraction('LD-IN-LGT' as never)).toBeCloseTo(0.3);

    runtime.shutdown();
  });

  it('emits exactly one SimulationTick per kernel tick', () => {
    const runtime = bootstrap(PROFILES.development);
    const kernel = runtime.container.resolve(SIMULATION_KERNEL);
    const bus = runtime.container.resolve(EVENT_BUS);

    let tickEvents = 0;
    const unsubscribe = bus.on('SimulationTick', () => {
      tickEvents += 1;
    });

    kernel.start();
    kernel.tick();
    kernel.tick();

    expect(tickEvents).toBe(2);

    unsubscribe();
    runtime.shutdown();
  });
});
