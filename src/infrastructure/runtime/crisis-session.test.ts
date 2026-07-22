import { PROFILES } from '@config';
import { GRID_EVENT } from '@constants';
import { EVENT_BUS } from '@core';
import { SIMULATION_ENGINE } from '@engine';
import { SCENARIO_REGISTRY } from '@scenarios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bootstrap } from '../bootstrap/bootstrap';
import type { AppRuntime } from '../bootstrap/bootstrap';
import { SIMULATION_KERNEL } from '../di/composition-root';

import { createCrisisSession } from './crisis-session';

describe('crisis session', () => {
  let runtime: AppRuntime;

  beforeEach(() => {
    vi.useFakeTimers();
    runtime = bootstrap(PROFILES.development);
  });

  afterEach(() => {
    runtime.shutdown();
    vi.useRealTimers();
  });

  it('drives kernel ticks on a fixed interval after start', () => {
    const kernel = runtime.container.resolve(SIMULATION_KERNEL);

    runtime.session.start('heatwave');
    expect(runtime.session.running).toBe(true);
    expect(runtime.session.activeScenarioId).toBe('heatwave');

    vi.advanceTimersByTime(1000); // 10 × 100 ms
    expect(kernel.clock.tick).toBe(10);
  });

  it('activates the scenario — heatwave harbor trip drops generation at tick 300', () => {
    const engine = runtime.container.resolve(SIMULATION_ENGINE);

    runtime.session.start('heatwave');

    vi.advanceTimersByTime(29_900); // tick 299
    const genBefore = engine.getState().totalGeneration;

    vi.advanceTimersByTime(200); // tick 301 — G-GAS-HB (60 MW) tripped at 300
    const genAfter = engine.getState().totalGeneration;

    expect(genAfter).toBeLessThan(genBefore);
  });

  it('pause halts ticking; resume continues', () => {
    const kernel = runtime.container.resolve(SIMULATION_KERNEL);

    runtime.session.start('heatwave');
    vi.advanceTimersByTime(500);
    expect(kernel.clock.tick).toBe(5);

    runtime.session.pause();
    expect(runtime.session.running).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(kernel.clock.tick).toBe(5);

    runtime.session.resume();
    vi.advanceTimersByTime(500);
    expect(kernel.clock.tick).toBe(10);
  });

  it('restarting a scenario resets the clock and re-arms scripted faults', () => {
    const kernel = runtime.container.resolve(SIMULATION_KERNEL);
    const engine = runtime.container.resolve(SIMULATION_ENGINE);

    runtime.session.start('heatwave');
    vi.advanceTimersByTime(30_500); // past the tick-300 harbor trip
    const trippedGen = engine.getState().totalGeneration;

    runtime.session.start('heatwave'); // restart
    expect(kernel.clock.tick).toBe(0);

    vi.advanceTimersByTime(29_000); // tick 290 — trip must NOT be active yet
    expect(engine.getState().totalGeneration).toBeGreaterThan(trippedGen);

    vi.advanceTimersByTime(1_500); // tick 305 — trip re-armed and fired again
    expect(engine.getState().totalGeneration).toBeLessThanOrEqual(trippedGen + 1);
  });

  it('emits GameEnded (Held) once at maxTicks and stops', () => {
    const kernel = runtime.container.resolve(SIMULATION_KERNEL);
    const bus = runtime.container.resolve(EVENT_BUS);
    const registry = runtime.container.resolve(SCENARIO_REGISTRY);

    const session = createCrisisSession({
      kernel,
      registry: () => registry,
      maxTicks: 30,
    });

    const gameEnded = vi.fn();
    bus.on(GRID_EVENT.GameEnded, gameEnded);

    session.start('heatwave');
    vi.advanceTimersByTime(10_000); // way past 30 ticks

    expect(gameEnded).toHaveBeenCalledTimes(1);
    expect(gameEnded).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'Held', score: 100 }),
    );
    expect(session.running).toBe(false);
    expect(kernel.clock.tick).toBe(30);
  });
});
