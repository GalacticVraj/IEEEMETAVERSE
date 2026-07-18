import { asLineId } from '@app-types';
import { describe, expect, it } from 'vitest';

import { DEFAULT_THERMAL_CONFIG } from './config';
import { createThermalState, steadyStateTempC, stepThermal } from './thermal';

const line = asLineId('l1');
const dt = 1;

describe('thermal model', () => {
  it('starts at ambient by default', () => {
    const thermal = createThermalState(line, DEFAULT_THERMAL_CONFIG);
    expect(thermal.temperatureC).toBe(DEFAULT_THERMAL_CONFIG.ambientC);
  });

  it('steady-state rises with the square of loading', () => {
    expect(steadyStateTempC(DEFAULT_THERMAL_CONFIG, 0)).toBe(25);
    expect(steadyStateTempC(DEFAULT_THERMAL_CONFIG, 1)).toBe(75); // 25 + 50·1
    expect(steadyStateTempC(DEFAULT_THERMAL_CONFIG, 2)).toBe(225); // 25 + 50·4
  });

  it('heats gradually toward steady state without jumping', () => {
    const start = createThermalState(line, DEFAULT_THERMAL_CONFIG);
    const stepped = stepThermal(start, 1.5, dt);
    const ss = steadyStateTempC(DEFAULT_THERMAL_CONFIG, 1.5);
    expect(stepped.thermal.temperatureC).toBeGreaterThan(start.temperatureC);
    expect(stepped.thermal.temperatureC).toBeLessThan(ss); // inertia — not instant
  });

  it('cools toward ambient when unloaded', () => {
    let thermal = createThermalState(line, DEFAULT_THERMAL_CONFIG, 90);
    thermal = stepThermal(thermal, 0, dt).thermal;
    expect(thermal.temperatureC).toBeLessThan(90);
    expect(thermal.temperatureC).toBeGreaterThan(DEFAULT_THERMAL_CONFIG.ambientC);
  });

  it('approaches steady state over many ticks', () => {
    let thermal = createThermalState(line, DEFAULT_THERMAL_CONFIG);
    for (let i = 0; i < 200; i += 1) thermal = stepThermal(thermal, 1, dt).thermal;
    expect(thermal.temperatureC).toBeCloseTo(75, 1);
  });

  it('flags a warning crossing exactly once', () => {
    const near = createThermalState(line, DEFAULT_THERMAL_CONFIG, 74);
    const first = stepThermal(near, 1.5, dt);
    expect(first.crossedWarning).toBe(true);
    expect(first.level).toBe('warning');
    const second = stepThermal(first.thermal, 1.5, dt);
    expect(second.crossedWarning).toBe(false);
  });

  it('flags a critical crossing above the safe limit', () => {
    const hot = createThermalState(line, DEFAULT_THERMAL_CONFIG, 89);
    const stepped = stepThermal(hot, 2, dt);
    expect(stepped.crossedCritical).toBe(true);
    expect(stepped.level).toBe('critical');
  });

  it('is deterministic', () => {
    const a = createThermalState(line, DEFAULT_THERMAL_CONFIG);
    const b = createThermalState(line, DEFAULT_THERMAL_CONFIG);
    expect(stepThermal(a, 1.3, dt)).toEqual(stepThermal(b, 1.3, dt));
  });
});
