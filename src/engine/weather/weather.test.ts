import { describe, expect, it } from 'vitest';

import {
  ColdWeatherModel,
  DeterministicWeatherModel,
  HeatwaveWeatherModel,
  StormWeatherModel,
} from './weather';

describe('DeterministicWeatherModel', () => {
  it('initial state is computed at tick 0', () => {
    const w = new DeterministicWeatherModel();
    const s = w.current();
    expect(s.temperature).toBeCloseTo(25, 1);
    // The shift opens in the afternoon, so the sun is up at tick 0.
    expect(s.irradiance).toBeGreaterThan(0.5);
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
  it('peaks above 38°C during the shift (Heatwave regime)', () => {
    // Heat now builds across the whole 1,800-tick shift and peaks into the
    // evening, instead of cycling every 400 ticks.
    const w = new HeatwaveWeatherModel();
    let peaked = false;
    for (let tick = 0; tick <= 1800; tick += 10) {
      const s = w.advance({ tick, time: tick as never, timestep: 1 as never });
      if (s.temperature >= 38) peaked = true;
    }
    expect(peaked).toBe(true);
  });

  it('kind is Heatwave when temperature >= 38°C', () => {
    const w = new HeatwaveWeatherModel();
    let sawHeatwave = false;
    for (let tick = 0; tick <= 1800; tick += 10) {
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

describe('the shift runs one afternoon-to-night arc', () => {
  const at = (model: DeterministicWeatherModel, tick: number) =>
    model.advance({ tick, time: tick as never, timestep: 0.1 as never });

  it('starts in daylight, not at midnight', () => {
    // The run opens in the AFTERNOON — the scenario and the renderer both say
    // so. Irradiance previously ran a 100-tick day, so it was ~0 at tick 0 and
    // the solar farm contributed nothing exactly when the city needed it.
    const w = new DeterministicWeatherModel();
    expect(at(w, 0).irradiance as number).toBeGreaterThan(0.5);
  });

  it('holds daylight through the first third of the shift', () => {
    const w = new DeterministicWeatherModel();
    expect(at(w, 400).irradiance as number).toBeGreaterThan(0.5);
  });

  it('falls to darkness by the end of the shift', () => {
    const w = new DeterministicWeatherModel();
    expect(at(w, 1750).irradiance as number).toBeLessThan(0.05);
  });

  it('decreases monotonically across the run — the sun sets once', () => {
    const w = new DeterministicWeatherModel();
    let previous = at(w, 0).irradiance as number;
    for (let tick = 100; tick <= 1800; tick += 100) {
      const next = at(w, tick).irradiance as number;
      expect(next).toBeLessThanOrEqual(previous + 1e-9);
      previous = next;
    }
  });

  it('heats once toward the evening peak rather than oscillating', () => {
    const w = new HeatwaveWeatherModel();
    const start = at(w, 0).temperature as number;
    const peak = at(w, 900).temperature as number;
    expect(peak).toBeGreaterThan(start);
    // A single arc: it must not have swung back up after coming down.
    const samples = [0, 300, 600, 900, 1200, 1500, 1800].map((t) => at(w, t).temperature as number);
    const maxIndex = samples.indexOf(Math.max(...samples));
    for (let i = 1; i < maxIndex; i += 1) {
      expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]!);
    }
  });
});
