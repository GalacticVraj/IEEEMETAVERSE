import { asCelsius, asGeneratorId, asMegaWatts, asRatio } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createEventBus } from '@core';
import { describe, expect, it, vi } from 'vitest';

import { MERIDIAN_BAY_TOPOLOGY } from '../topology/meridian-bay';
import { MeridianBayGenerationModel } from './generation';

describe('MeridianBayGenerationModel', () => {
  const makeMockContext = () => {
    const events = createEventBus<any>();
    const emitSpy = vi.spyOn(events, 'emit');
    return {
      events,
      rng: {} as any,
      clock: {} as any,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        child: () => (this as any).logger,
      } as any,
      emitSpy,
    };
  };

  it('calculates dispatch based on merit order', () => {
    const model = new MeridianBayGenerationModel();
    const ctx = makeMockContext();
    model.init(ctx);

    const weather = { kind: 'Clear', temperature: asCelsius(25), wind: asRatio(0.5), irradiance: asRatio(1.0) };
    // Demand = 600 MW
    let dispatch = model.dispatch(MERIDIAN_BAY_TOPOLOGY, weather, asMegaWatts(600));
    expect(model.totalOutput()).toBeCloseTo(575, 0); // restricted by G-IMPORT ramp limit of 10

    // Dispatch a few more times to let it ramp up
    model.dispatch(MERIDIAN_BAY_TOPOLOGY, weather, asMegaWatts(600));
    model.dispatch(MERIDIAN_BAY_TOPOLOGY, weather, asMegaWatts(600));
    dispatch = model.dispatch(MERIDIAN_BAY_TOPOLOGY, weather, asMegaWatts(600));

    const total = model.totalOutput();
    expect(total).toBeCloseTo(600, 0);

    // Baseload G-BASE-S has capacity 400 MW. Must be 400 MW.
    expect(model.getGeneratorOutput(asGeneratorId('G-BASE-S'))).toBe(400);

    // Solar G-SOLAR has capacity 120 MW, weather.irradiance = 1.0. Must be 120 MW.
    expect(model.getGeneratorOutput(asGeneratorId('G-SOLAR'))).toBe(120);

    // Wind G-WIND has capacity 90 MW, wind = 0.5. Must be 45 MW.
    expect(model.getGeneratorOutput(asGeneratorId('G-WIND'))).toBe(45);

    // Remaining demand: 600 - (400 + 120 + 45) = 35 MW.
    // G-IMPORT has fully ramped to 35 MW.
    expect(model.getGeneratorOutput(asGeneratorId('G-IMPORT'))).toBe(35);

    // Let's verify events are emitted
    expect(ctx.emitSpy).toHaveBeenCalledWith(GRID_EVENT.GenerationChanged, expect.any(Object));
  });

  it('obeys ramp rate limits over multiple ticks', () => {
    const model = new MeridianBayGenerationModel();
    model.init(makeMockContext());

    const weather = { kind: 'Clear', temperature: asCelsius(25), wind: asRatio(0), irradiance: asRatio(0) };

    // Tick 1: Target = 600 MW, base load = 400 MW, import needed = 200 MW.
    // Import limit is 10 MW/tick. It should ramp from 0 to 10 MW.
    model.dispatch(MERIDIAN_BAY_TOPOLOGY, weather, asMegaWatts(600));
    expect(model.getGeneratorOutput(asGeneratorId('G-IMPORT'))).toBe(10);

    // Tick 2: Target = 600 MW. Import should ramp from 10 to 20 MW.
    model.dispatch(MERIDIAN_BAY_TOPOLOGY, weather, asMegaWatts(600));
    expect(model.getGeneratorOutput(asGeneratorId('G-IMPORT'))).toBe(20);
  });

  it('handles generator tripping and removes capacity', () => {
    const model = new MeridianBayGenerationModel();
    model.init(makeMockContext());

    const weather = { kind: 'Clear', temperature: asCelsius(25), wind: asRatio(0.5), irradiance: asRatio(1.0) };

    model.tripGenerator(asGeneratorId('G-BASE-S'));
    model.dispatch(MERIDIAN_BAY_TOPOLOGY, weather, asMegaWatts(600));

    // G-BASE-S must be 0 MW
    expect(model.getGeneratorOutput(asGeneratorId('G-BASE-S'))).toBe(0);
  });

  it('snapshots and restores tripped/output state', () => {
    const model = new MeridianBayGenerationModel();
    model.init(makeMockContext());

    model.tripGenerator(asGeneratorId('G-BASE-S'));
    const snap = model.captureState();

    model.reset();
    expect(model.isTripped(asGeneratorId('G-BASE-S'))).toBe(false);

    model.restoreState(snap);
    expect(model.isTripped(asGeneratorId('G-BASE-S'))).toBe(true);
  });
});
