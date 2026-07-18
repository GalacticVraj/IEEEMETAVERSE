import { asScenarioId } from '@app-types';
import { PROFILES } from '@config';
import { EVENT_BUS, LOGGER, SERIALIZER } from '@core';
import { SIMULATION_ENGINE } from '@engine';
import { SCENARIO_REGISTRY } from '@scenarios';
import { describe, expect, it } from 'vitest';

import { SIMULATION_KERNEL } from '../di/composition-root';
import { bootstrap } from './bootstrap';

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

  it('registers the heatwave scenario in the registry', () => {
    const runtime = bootstrap(PROFILES.development);
    const registry = runtime.container.resolve(SCENARIO_REGISTRY);
    expect(registry.has(asScenarioId('heatwave'))).toBe(true);
    expect(registry.all()).toHaveLength(1);
    runtime.shutdown();
  });

  it('shuts down cleanly without throwing', () => {
    const runtime = bootstrap(PROFILES.competition);
    expect(() => {
      runtime.shutdown();
    }).not.toThrow();
  });
});
