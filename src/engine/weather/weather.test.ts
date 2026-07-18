import { describe, expect, it } from 'vitest';

import { ColdWeatherModel, DeterministicWeatherModel, HeatwaveWeatherModel, StormWeatherModel } from './weather';

describe('DeterministicWeatherModel', () => {
  it('initial state is computed at tick 0', () => {
    const w = new DeterministicWeatherModel();
    const s = w.current();
    expect(s.temperature).toBeCloseTo(25, 1);
    expect(s.irradiance).toBe(0);
    expect(s.wind).toBeGreaterThanOrEqual(0);
    expect(s.wind).toBeLessThanOrEqual(1);
  });

  it('advance returns new state each tick', () => {
    const w = new DeterministicWeatherModel();
    const s1 = w.advance({ tick: 1, time: 1 as never, timestep: 1 as never });
    const s2 = w.advance({ tick: 2, time: 2 as never, timestep: 1 as never });
    // Different ticks → likely different irradiance
    expect(s2).not.toBe(s1);
    expect(w.current()).toEqual(s2);
  });

  it('is deterministic: same tick produces same state', () => {
    const a = new DeterministicWeatherModel();
    const b = new DeterministicWeatherModel();
    const ctx = { tick: 50, time: 50 as never, timestep: 1 as never };
    expect(a.advance(ctx)).toEqual(b.advance(ctx));
  });

  it('irradiance is clamped to [0, 1]', () => {
    const w = new DeterministicWeatherModel();
    for (let tick = 0; tick < 200; tick++) {
      const s = w.advance({ tick, time: tick as never, timestep: 1 as never });
      expect(s.irradiance).toBeGreaterThanOrEqual(0);
      expect(s.irradiance).toBeLessThanOrEqual(1);
    }
  });

  it('wind is clamped to [0, 1]', () => {
    const w = new DeterministicWeatherModel();
    for (let tick = 0; tick < 400; tick++) {
      const s = w.advance({ tick, time: tick as never, timestep: 1 as never });
      expect(s.wind).toBeGreaterThanOrEqual(0);
      expect(s.wind).toBeLessThanOrEqual(1);
    }
  });
});

describe('HeatwaveWeatherModel', () => {
  it('peaks above 38°C within 200 ticks (Heatwave regime)', () => {
    const w = new HeatwaveWeatherModel();
    let peaked = false;
    for (let tick = 0; tick <= 200; tick++) {
      const s = w.advance({ tick, time: tick as never, timestep: 1 as never });
      if (s.temperature >= 38) peaked = true;
    }
    expect(peaked).toBe(true);
  });

  it('kind is Heatwave when temperature >= 38°C', () => {
    const w = new HeatwaveWeatherModel();
    let sawHeatwave = false;
    for (let tick = 0; tick <= 200; tick++) {
      const s = w.advance({ tick, time: tick as never, timestep: 1 as never });
      if (s.kind === 'Heatwave') sawHeatwave = true;
    }
    expect(sawHeatwave).toBe(true);
  });
});

describe('StormWeatherModel', () => {
  it('has high wind (>0.7) and kind Storm', () => {
    const w = new StormWeatherModel();
    const s = w.advance({ tick: 1, time: 1 as never, timestep: 1 as never });
    expect(s.wind).toBeGreaterThan(0.7);
    expect(s.kind).toBe('Storm');
  });

  it('has low irradiance during storm', () => {
    const w = new StormWeatherModel();
    // At tick 50 (midday), irradiance is still capped by low irradianceBase
    const s = w.advance({ tick: 50, time: 50 as never, timestep: 1 as never });
    expect(s.irradiance).toBeLessThan(0.3);
  });
});

describe('ColdWeatherModel', () => {
  it('temperature is cold (< 10°C)', () => {
    const w = new ColdWeatherModel();
    const s = w.advance({ tick: 0, time: 0 as never, timestep: 1 as never });
    expect(s.temperature).toBeLessThan(10);
    expect(s.kind).toBe('Cold');
  });
});
