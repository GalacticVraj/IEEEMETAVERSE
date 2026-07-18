import { asCelsius, asLoadId, asRatio } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createEventBus } from '@core';
import { describe, expect, it, vi } from 'vitest';

import { MERIDIAN_BAY_TOPOLOGY } from '../topology/meridian-bay';
import { MeridianBayLoadModel } from './loads';

describe('MeridianBayLoadModel', () => {
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

  it('calculates nominal demand at 25C', () => {
    const model = new MeridianBayLoadModel();
    const ctx = makeMockContext();
    model.init(ctx);

    const weather = { kind: 'Clear', temperature: asCelsius(25), wind: asRatio(0.2), irradiance: asRatio(0.5) };
    const demands = model.demand(MERIDIAN_BAY_TOPOLOGY, weather);

    // Sum of nominal demands should equal total demand
    const sum = demands.reduce((acc, z) => acc + z.demand, 0);
    expect(sum).toBeCloseTo(895, 0);
    expect(model.totalDemand()).toBeCloseTo(895, 0);
    expect(ctx.emitSpy).toHaveBeenCalledWith(GRID_EVENT.LoadChanged, expect.any(Object));
  });

  it('increases residential demand during heatwave (> 25C)', () => {
    const model = new MeridianBayLoadModel();
    model.init(makeMockContext());

    const weather25 = { kind: 'Clear', temperature: asCelsius(25), wind: asRatio(0.2), irradiance: asRatio(0.5) };
    model.demand(MERIDIAN_BAY_TOPOLOGY, weather25);
    const demand25 = model.totalDemand();

    const weather40 = { kind: 'Heatwave', temperature: asCelsius(40), wind: asRatio(0.2), irradiance: asRatio(0.5) };
    model.demand(MERIDIAN_BAY_TOPOLOGY, weather40);
    const demand40 = model.totalDemand();

    expect(demand40).toBeGreaterThan(demand25);
  });

  it('increases residential demand during cold snap (< 15C)', () => {
    const model = new MeridianBayLoadModel();
    model.init(makeMockContext());

    const weather20 = { kind: 'Clear', temperature: asCelsius(20), wind: asRatio(0.2), irradiance: asRatio(0.5) };
    model.demand(MERIDIAN_BAY_TOPOLOGY, weather20);
    const demand20 = model.totalDemand();

    const weather5 = { kind: 'Cold', temperature: asCelsius(5), wind: asRatio(0.2), irradiance: asRatio(0.5) };
    model.demand(MERIDIAN_BAY_TOPOLOGY, weather5);
    const demand5 = model.totalDemand();

    expect(demand5).toBeGreaterThan(demand20);
  });

  it('supports load shedding but protects critical loads', () => {
    const model = new MeridianBayLoadModel();
    model.init(makeMockContext());

    // Shed 50% of residential North A (LD-RN-A) and 50% of hospital (LD-DT-HOSP)
    model.shedLoad(asLoadId('LD-RN-A'), 0.5);
    model.shedLoad(asLoadId('LD-DT-HOSP'), 0.5);

    const weather = { kind: 'Clear', temperature: asCelsius(25), wind: asRatio(0.2), irradiance: asRatio(0.5) };
    model.demand(MERIDIAN_BAY_TOPOLOGY, weather);

    // Hospital is critical, should stay at 20 MW (100% load)
    expect(model.getLoadDemand(asLoadId('LD-DT-HOSP'))).toBe(20);
    // Residential North A is sheddable, base nominal is 55 MW, at 50% shed it should be 27.5 MW
    expect(model.getLoadDemand(asLoadId('LD-RN-A'))).toBeCloseTo(27.5, 1);
  });

  it('snapshots and restores shedding state', () => {
    const model = new MeridianBayLoadModel();
    model.init(makeMockContext());

    model.shedLoad(asLoadId('LD-RN-A'), 0.8);
    const snap = model.captureState();

    model.reset();
    expect(model.getShedFraction(asLoadId('LD-RN-A'))).toBe(0);

    model.restoreState(snap);
    expect(model.getShedFraction(asLoadId('LD-RN-A'))).toBe(0.8);
  });
});
