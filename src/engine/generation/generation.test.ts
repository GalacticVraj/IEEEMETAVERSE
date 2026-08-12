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

    const weather = {
      kind: 'Clear' as const,
      temperature: asCelsius(25),
      wind: asRatio(0.5),
      irradiance: asRatio(1.0),
    };
    // Demand = 600 MW. The first dispatch after a reset establishes the
    // operating point directly — the operator inherits a running grid — so
    // merit order is satisfied immediately rather than after a ramp.
    model.dispatch(MERIDIAN_BAY_TOPOLOGY, weather, asMegaWatts(600));

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

    const weather = {
      kind: 'Clear' as const,
      temperature: asCelsius(25),
      wind: asRatio(0),
      irradiance: asRatio(0),
    };

    // Prime the operating point at a low demand so the import tie sits at 0.
    model.dispatch(MERIDIAN_BAY_TOPOLOGY, weather, asMegaWatts(400));
    expect(model.getGeneratorOutput(asGeneratorId('G-IMPORT'))).toBe(0);

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

    const weather = {
      kind: 'Clear' as const,
      temperature: asCelsius(25),
      wind: asRatio(0.5),
      irradiance: asRatio(1.0),
    };

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

  // -------------------------------------------------------------------------
  // Governor response — ramp limits ARE primary frequency response
  // -------------------------------------------------------------------------

  const hotWeather = {
    temperature: asCelsius(40),
    irradiance: asRatio(1),
    wind: asRatio(1),
  } as never;

  it('ramps governed units harder when frequency is depressed', () => {
    const nominal = new MeridianBayGenerationModel();
    const depressed = new MeridianBayGenerationModel();
    nominal.init(makeMockContext() as never);
    depressed.init(makeMockContext() as never);

    // Prime both with the same starting outputs at nominal frequency.
    nominal.dispatch(MERIDIAN_BAY_TOPOLOGY, hotWeather, asMegaWatts(600), 60);
    depressed.dispatch(MERIDIAN_BAY_TOPOLOGY, hotWeather, asMegaWatts(600), 60);

    // Now ask for far more than either can reach in a single tick.
    nominal.dispatch(MERIDIAN_BAY_TOPOLOGY, hotWeather, asMegaWatts(1100), 60);
    depressed.dispatch(MERIDIAN_BAY_TOPOLOGY, hotWeather, asMegaWatts(1100), 59.0);

    expect(depressed.totalOutput() as number).toBeGreaterThan(nominal.totalOutput() as number);
  });

  it('does not exceed rated capacity however urgent the governor', () => {
    const model = new MeridianBayGenerationModel();
    model.init(makeMockContext() as never);
    for (let i = 0; i < 200; i += 1) {
      model.dispatch(MERIDIAN_BAY_TOPOLOGY, hotWeather, asMegaWatts(2000), 57.0);
    }
    // Derived, not hardcoded — installed capacity is a topology fact and this
    // assertion is about the clamp, not about a particular fleet size.
    const installedMw = MERIDIAN_BAY_TOPOLOGY.generators.reduce(
      (sum, g) => sum + (g.capacity as number),
      0,
    );
    expect(model.totalOutput() as number).toBeLessThanOrEqual(installedMw);
  });

  it('does not rush a ramp DOWN because frequency is low', () => {
    // A governor does not close a valve faster just because frequency fell.
    const model = new MeridianBayGenerationModel();
    model.init(makeMockContext() as never);
    for (let i = 0; i < 40; i += 1) {
      model.dispatch(MERIDIAN_BAY_TOPOLOGY, hotWeather, asMegaWatts(1100), 60);
    }
    const high = model.totalOutput() as number;
    model.dispatch(MERIDIAN_BAY_TOPOLOGY, hotWeather, asMegaWatts(400), 58.0);
    const afterOneTick = model.totalOutput() as number;
    // Ramp-down is still limited to the base rate, so one tick cannot undo it.
    expect(high - afterOneTick).toBeLessThanOrEqual(40);
  });

  it('starts from a dispatched operating point, not from zero output', () => {
    // An operator takes over a grid that is ALREADY RUNNING. Starting every
    // ramp-limited unit at 0 MW created a ~600 MW phantom deficit on tick 0
    // that crashed frequency and fired every UFLS stage before the player
    // could act. The first dispatch after a reset establishes the operating
    // point; ramp limits govern every tick after it.
    const model = new MeridianBayGenerationModel();
    model.init(makeMockContext() as never);

    const demand = asMegaWatts(900);
    model.dispatch(MERIDIAN_BAY_TOPOLOGY, hotWeather, demand, 60);

    // Within a few MW of the ask on the very first tick.
    expect(model.totalOutput() as number).toBeGreaterThan(880);
  });

  it('still applies ramp limits on the tick after the first', () => {
    const model = new MeridianBayGenerationModel();
    model.init(makeMockContext() as never);

    model.dispatch(MERIDIAN_BAY_TOPOLOGY, hotWeather, asMegaWatts(600), 60);
    const primed = model.totalOutput() as number;
    model.dispatch(MERIDIAN_BAY_TOPOLOGY, hotWeather, asMegaWatts(1100), 60);
    const afterOne = model.totalOutput() as number;

    // A single tick cannot close a 500 MW gap — ramp limits are back in force.
    expect(afterOne - primed).toBeLessThan(200);
  });

  it('re-primes after reset', () => {
    const model = new MeridianBayGenerationModel();
    model.init(makeMockContext() as never);
    model.dispatch(MERIDIAN_BAY_TOPOLOGY, hotWeather, asMegaWatts(900), 60);
    model.reset();
    model.dispatch(MERIDIAN_BAY_TOPOLOGY, hotWeather, asMegaWatts(900), 60);
    expect(model.totalOutput() as number).toBeGreaterThan(880);
  });
});
