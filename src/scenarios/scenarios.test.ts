/**
 * Scenario integration tests.
 *
 * Each scenario is instantiated, setup() called, then onTick() driven across a
 * FULL 1,800-tick shift. Tests verify:
 *   1. No exception is thrown during setup, any tick, or teardown.
 *   2. The fault API calls are routed correctly (mock verification).
 *   3. Each scenario declares its own environment.
 *   4. No scenario finishes its arc in the opening seconds of the shift.
 */
import { asGeneratorId, asLineId, asLoadId } from '@app-types';
import type { GeneratorId, LineId, LoadId, Seconds } from '@app-types';
import type { TickContext } from '@core';
import { describe, expect, it, vi } from 'vitest';

import { DeterministicWeatherModel, STORM_ARC } from '@engine';
import type { WeatherArc, WeatherState } from '@engine';

import type { ICrisisScenario, ScenarioContext, ScenarioFaultApi } from './crisis-scenario';
import { ColdSnapScenario } from './cold-snap/cold-snap-scenario';
import { CyberAttackScenario } from './cyber-attack/cyber-attack-scenario';
import { DemandSurgeScenario } from './demand-surge/demand-surge-scenario';
import { EquipmentFailureScenario } from './equipment-failure/equipment-failure-scenario';
import { clearGenerationForecast, generationForecast } from './generation-forecast';
import { GeneratorLossScenario } from './generator-loss/generator-loss-scenario';
import { HeatwaveScenario } from './heatwave/heatwave-scenario';
import { SHIFT_TICKS, at } from './shift-clock';
import { StormScenario } from './storm/storm-scenario';
import { SubstationFailureScenario } from './substation-failure/substation-failure-scenario';
import { resetTelemetryTrust, telemetryTrust } from './telemetry-trust';
import { TransformerFailureScenario } from './transformer-failure/transformer-failure-scenario';

// ---------------------------------------------------------------------------
// Test harness helpers
// ---------------------------------------------------------------------------

/** Create a mock ScenarioFaultApi with vi spies. */
function makeMockFaults(): ScenarioFaultApi & {
  _tripCalls: GeneratorId[];
  _untripCalls: GeneratorId[];
  _shedCalls: [LoadId, number][];
  _openCalls: LineId[];
  _resetCalls: number;
} {
  const _tripCalls: GeneratorId[] = [];
  const _untripCalls: GeneratorId[] = [];
  const _shedCalls: [LoadId, number][] = [];
  const _openCalls: LineId[] = [];
  let _resetCalls = 0;

  return {
    _tripCalls,
    _untripCalls,
    _shedCalls,
    _openCalls,
    get _resetCalls() {
      return _resetCalls;
    },
    tripGenerator(id: GeneratorId) {
      _tripCalls.push(id);
    },
    untripGenerator(id: GeneratorId) {
      _untripCalls.push(id);
    },
    shedLoad(id: LoadId, fraction: number) {
      _shedCalls.push([id, fraction]);
    },
    resetShedding() {
      _resetCalls++;
    },
    commandOpenLine(line: LineId) {
      _openCalls.push(line);
    },
  };
}

/** Records every arc a scenario declares, so tests can assert it declared one. */
function makeMockWeather(): ScenarioContext['weather'] & { _arcs: WeatherArc[] } {
  const _arcs: WeatherArc[] = [];
  let state: WeatherState = {
    kind: 'Clear' as WeatherState['kind'],
    temperature: 25 as WeatherState['temperature'],
    irradiance: 0.7 as WeatherState['irradiance'],
    wind: 0.3 as WeatherState['wind'],
  };
  return {
    _arcs,
    setArc(arc: WeatherArc) {
      _arcs.push(arc);
      state = {
        ...state,
        temperature: arc.baseTempC as WeatherState['temperature'],
        irradiance: arc.irradianceBase as WeatherState['irradiance'],
        wind: arc.windBase as WeatherState['wind'],
      };
    },
    current: () => state,
  };
}

function makeScenarioContext(
  faults: ScenarioFaultApi,
  weather: ScenarioContext['weather'] = makeMockWeather(),
): ScenarioContext {
  return {
    engine: {
      id: 'simulation-engine' as any,
      getState: () => ({}) as any,
      init: vi.fn(),
      step: vi.fn(),
      reset: vi.fn(),
      dispose: vi.fn(),
    },
    faults,
    weather,
    generation: {
      isTripped: () => false,
      totalOutput: () => 0 as any,
      getGeneratorOutput: () => 0 as any,
    },
    loads: {
      getShedFraction: () => 0,
      totalDemand: () => 0 as any,
      getLoadDemand: () => 0 as any,
    },
    protection: {
      thermalFor: () => undefined,
      breakerFor: () => undefined,
      relayFor: () => undefined,
    },
  };
}

function makeTickContext(tick: number): TickContext {
  return {
    tick,
    time: tick as Seconds,
    timestep: 1 as Seconds,
  };
}

/**
 * Run a scenario for `ticks` steps and return the fault api for assertions.
 *
 * The default is a FULL SHIFT. It used to be 120 ticks, which quietly encoded
 * the bug these tests now guard against: every scenario except the heatwave
 * fired its whole arc inside the first ~8 seconds of a three-minute run, and a
 * 120-tick harness was long enough to see all of it and call that correct.
 */
function runScenario(
  scenario: ICrisisScenario,
  ticks = SHIFT_TICKS,
): ReturnType<typeof makeMockFaults> {
  const faults = makeMockFaults();
  const context = makeScenarioContext(faults);
  scenario.setup(context);
  for (let t = 0; t <= ticks; t++) {
    scenario.onTick(makeTickContext(t));
  }
  scenario.teardown();
  return faults;
}

/** Run without tearing down, so mid-run state can be inspected. */
function runTo(
  scenario: ICrisisScenario,
  ticks: number,
  weather = makeMockWeather(),
): { faults: ReturnType<typeof makeMockFaults>; weather: ReturnType<typeof makeMockWeather> } {
  const faults = makeMockFaults();
  scenario.setup(makeScenarioContext(faults, weather));
  for (let t = 0; t <= ticks; t++) scenario.onTick(makeTickContext(t));
  return { faults, weather };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HeatwaveScenario (C3 demo arc: harbor @300, baseload @600)', () => {
  it('does not throw over a full arc', () => {
    expect(() => runScenario(new HeatwaveScenario(), 700)).not.toThrow();
  });

  it('trips G-GAS-HB at tick 300 (first tension) but not before', () => {
    const early = runScenario(new HeatwaveScenario(), 299);
    expect(early._tripCalls).not.toContain(asGeneratorId('G-GAS-HB'));
    const later = runScenario(new HeatwaveScenario(), 300);
    expect(later._tripCalls).toContain(asGeneratorId('G-GAS-HB'));
  });

  it('trips G-BASE-S at tick 600 (the big one)', () => {
    const faults = runScenario(new HeatwaveScenario(), 600);
    expect(faults._tripCalls).toContain(asGeneratorId('G-BASE-S'));
  });

  it('performs NO scripted rescue shedding — the outcome belongs to the operator', () => {
    const faults = runScenario(new HeatwaveScenario(), 700);
    expect(faults._shedCalls).toHaveLength(0);
  });

  it('untrips all generators on teardown', () => {
    const faults = runScenario(new HeatwaveScenario(), 700);
    expect(faults._untripCalls).toContain(asGeneratorId('G-BASE-S'));
    expect(faults._untripCalls).toContain(asGeneratorId('G-GAS-HB'));
  });
});

describe('StormScenario', () => {
  it('does not throw over a full shift', () => {
    expect(() => runScenario(new StormScenario())).not.toThrow();
  });

  it('declares the storm arc — without it the storm had no wind in it', () => {
    const { weather } = runTo(new StormScenario(), 0);
    expect(weather._arcs[0]).toEqual(STORM_ARC);
  });

  it('keeps wind above the Storm classification threshold for the whole shift', () => {
    // classifyKind() calls it a Storm only above 0.7. The old arc dipped to
    // 0.65 at the gust trough, so the weather flapped Storm/Clear twice a run
    // and the lightning switched itself off mid-storm.
    const model = new DeterministicWeatherModel();
    model.setArc(STORM_ARC);
    for (let tick = 0; tick <= SHIFT_TICKS; tick += 25) {
      const state = model.advance({ tick, time: tick as Seconds, timestep: 0.1 as Seconds });
      expect(state.wind as number).toBeGreaterThan(0.7);
      expect(state.kind).toBe('Storm');
    }
  });

  it('spreads its faults across the shift instead of the opening seconds', () => {
    const early = runTo(new StormScenario(), at(0, 10));
    expect(early.faults._openCalls).toHaveLength(0);

    const full = runScenario(new StormScenario());
    expect(full._openCalls).toContain(asLineId('GN1-DT1'));
    expect(full._openCalls).toContain(asLineId('HB1-HB2'));
    expect(full._openCalls).toContain(asLineId('RS3-HB1'));
    expect(full._tripCalls).toContain(asGeneratorId('G-WIND'));
  });

  it('loses the wind farm to overspeed only in the back half of the shift', () => {
    const before = runTo(new StormScenario(), at(1, 40));
    expect(before.faults._tripCalls).not.toContain(asGeneratorId('G-WIND'));
    const after = runTo(new StormScenario(), at(1, 50));
    expect(after.faults._tripCalls).toContain(asGeneratorId('G-WIND'));
  });
});

describe('EquipmentFailureScenario', () => {
  it('does not throw over a full shift', () => {
    expect(() => runScenario(new EquipmentFailureScenario())).not.toThrow();
  });

  it('opens its three corridors, spread across the shift', () => {
    expect(runTo(new EquipmentFailureScenario(), at(0, 10)).faults._openCalls).toHaveLength(0);
    const faults = runScenario(new EquipmentFailureScenario());
    expect(faults._openCalls).toEqual([
      asLineId('DT4-HB1'),
      asLineId('IN1-HB1'),
      asLineId('DT1-IN1'),
    ]);
  });
});

describe('CyberAttackScenario', () => {
  it('does not throw over a full shift', () => {
    expect(() => runScenario(new CyberAttackScenario())).not.toThrow();
  });

  it('compromises telemetry trust from the first tick', () => {
    resetTelemetryTrust();
    const scenario = new CyberAttackScenario();
    scenario.setup(makeScenarioContext(makeMockFaults()));
    expect(telemetryTrust().compromised).toBe(true);
    expect(telemetryTrust().reason).toBeTruthy();
    scenario.teardown();
  });

  it('restores telemetry trust partway through, not at the end', () => {
    resetTelemetryTrust();
    const scenario = new CyberAttackScenario();
    scenario.setup(makeScenarioContext(makeMockFaults()));
    for (let t = 0; t <= at(1, 29); t++) scenario.onTick(makeTickContext(t));
    expect(telemetryTrust().compromised).toBe(true);
    scenario.onTick(makeTickContext(at(1, 30)));
    expect(telemetryTrust().compromised).toBe(false);
    scenario.teardown();
  });

  it('always leaves trust intact on teardown', () => {
    resetTelemetryTrust();
    const scenario = new CyberAttackScenario();
    scenario.setup(makeScenarioContext(makeMockFaults()));
    expect(telemetryTrust().compromised).toBe(true);
    scenario.teardown();
    expect(telemetryTrust().compromised).toBe(false);
  });

  it('opens two breakers and kills the import tie, across the shift', () => {
    const faults = runScenario(new CyberAttackScenario());
    expect(faults._openCalls).toEqual([asLineId('GS1-DT1'), asLineId('DT1-IN1')]);
    expect(faults._tripCalls).toContain(asGeneratorId('G-IMPORT'));
  });

  it('no longer sheds load on the operator’s behalf', () => {
    // The old arc fired a scripted UFLS shed at tick 85, which took the
    // decision away from the player and made the outcome unattributable.
    const faults = runScenario(new CyberAttackScenario());
    expect(faults._shedCalls).toHaveLength(0);
  });
});

describe('DemandSurgeScenario (renewable intermittency)', () => {
  it('does not throw over a full shift', () => {
    expect(() => runScenario(new DemandSurgeScenario())).not.toThrow();
  });

  it('publishes a forecast up front', () => {
    clearGenerationForecast();
    const scenario = new DemandSurgeScenario();
    scenario.setup(makeScenarioContext(makeMockFaults()));
    expect(generationForecast()).not.toBeNull();
    expect(generationForecast()?.windForecast).toBeGreaterThan(0);
    scenario.teardown();
  });

  it('never corrects the forecast to match reality — the gap IS the lesson', () => {
    clearGenerationForecast();
    const scenario = new DemandSurgeScenario();
    scenario.setup(makeScenarioContext(makeMockFaults()));
    const promised = generationForecast();
    for (let t = 0; t <= SHIFT_TICKS; t++) scenario.onTick(makeTickContext(t));
    expect(generationForecast()).toEqual(promised);
    scenario.teardown();
  });

  it('drops irradiance as the cloud bank crosses, rather than faking an output', () => {
    const start = runTo(new DemandSurgeScenario(), at(0, 10));
    const end = runTo(new DemandSurgeScenario(), at(1, 10));
    const first = start.weather.current().irradiance as number;
    const last = end.weather.current().irradiance as number;
    expect(last).toBeLessThan(first * 0.6);
  });

  it('drops wind below the forecast — the miss the panel reports', () => {
    clearGenerationForecast();
    const run = runTo(new DemandSurgeScenario(), at(1, 30));
    const forecast = generationForecast();
    expect(run.weather.current().wind as number).toBeLessThan(forecast?.windForecast ?? 1);
  });

  it('sheds nothing itself — the previous arc shed FOR the operator', () => {
    const faults = runScenario(new DemandSurgeScenario());
    expect(faults._shedCalls).toHaveLength(0);
  });
});

describe('ColdSnapScenario', () => {
  it('does not throw over a full shift', () => {
    expect(() => runScenario(new ColdSnapScenario())).not.toThrow();
  });

  it('drives the temperature down rather than scripting a demand number', () => {
    const start = runTo(new ColdSnapScenario(), 0);
    const later = runTo(new ColdSnapScenario(), at(0, 30));
    expect(later.weather.current().temperature as number).toBeLessThan(
      start.weather.current().temperature as number,
    );
    expect(later.weather.current().temperature as number).toBeLessThan(0);
  });

  it('takes BOTH gas peakers when pipeline pressure drops', () => {
    // The point of the scenario: in a freeze the fuel supply and the demand
    // spike have the same cause, so the units you would reach for are the
    // units you lose.
    const faults = runScenario(new ColdSnapScenario());
    expect(faults._tripCalls).toContain(asGeneratorId('G-PEAK-S'));
    expect(faults._tripCalls).toContain(asGeneratorId('G-PEAK-IN'));
  });

  it('untrips the peakers on teardown', () => {
    const faults = runScenario(new ColdSnapScenario());
    expect(faults._untripCalls).toContain(asGeneratorId('G-PEAK-S'));
    expect(faults._untripCalls).toContain(asGeneratorId('G-PEAK-IN'));
  });
});

describe('GeneratorLossScenario', () => {
  it('trips its units and unwinds them on teardown', () => {
    const faults = runScenario(new GeneratorLossScenario());
    expect(faults._tripCalls).toContain(asGeneratorId('G-BASE-S'));
    expect(faults._tripCalls).toContain(asGeneratorId('G-PEAK-S'));
    expect(faults._untripCalls).toContain(asGeneratorId('G-BASE-S'));
    expect(faults._untripCalls).toContain(asGeneratorId('G-PEAK-S'));
  });
});

describe('SubstationFailureScenario', () => {
  it('opens all three IN2 breakers', () => {
    const faults = runScenario(new SubstationFailureScenario());
    expect(faults._openCalls).toContain(asLineId('IN1-IN2'));
    expect(faults._openCalls).toContain(asLineId('IN2-IN3'));
    expect(faults._openCalls).toContain(asLineId('IN2-RS1'));
  });
});

describe('TransformerFailureScenario', () => {
  it('opens the GS1 corridors and trips the islanded units', () => {
    const faults = runScenario(new TransformerFailureScenario());
    expect(faults._openCalls).toContain(asLineId('GS1-DT1'));
    expect(faults._openCalls).toContain(asLineId('GS1-IN1'));
    expect(faults._openCalls).toContain(asLineId('GS1-RS1'));
    expect(faults._tripCalls).toContain(asGeneratorId('G-BASE-S'));
    expect(faults._shedCalls.some(([id]) => id === asLoadId('LD-IN-HVY'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invariants that hold for EVERY scenario
// ---------------------------------------------------------------------------

describe('Scenario registry invariants', () => {
  const build = (): ICrisisScenario[] => [
    new HeatwaveScenario(),
    new StormScenario(),
    new EquipmentFailureScenario(),
    new CyberAttackScenario(),
    new GeneratorLossScenario(),
    new SubstationFailureScenario(),
    new DemandSurgeScenario(),
    new ColdSnapScenario(),
    new TransformerFailureScenario(),
  ];

  it('all scenarios have unique IDs', () => {
    const ids = build().map((s) => s.metadata.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all scenarios have non-empty name and summary', () => {
    for (const s of build()) {
      expect(s.metadata.name.length).toBeGreaterThan(0);
      expect(s.metadata.summary.length).toBeGreaterThan(0);
    }
  });

  it('every scenario declares a weather arc in setup', () => {
    // The regression this guards: the app registered ONE generic weather model
    // for all of them, so "Record Heatwave" ran at a flat 25 °C with no heat
    // build and "Coastal Storm" ran at wind 0.3 — classified Clear.
    for (const scenario of build()) {
      const weather = makeMockWeather();
      scenario.setup(makeScenarioContext(makeMockFaults(), weather));
      expect(weather._arcs.length).toBeGreaterThan(0);
      scenario.teardown();
    }
  });

  it('no scenario has finished its arc in the first ten seconds', () => {
    // The bug that prompted the re-choreography: seven of eight scenarios ran
    // ticks 20–85 of an 1,800-tick shift, so everything happened before the
    // intro camera had landed and the remaining 2:50 was an empty grid.
    for (const scenario of build()) {
      const early = runTo(scenario, at(0, 10));
      const full = runScenario(scenario);
      const earlyEvents = early.faults._openCalls.length + early.faults._tripCalls.length;
      const allEvents = full._openCalls.length + full._tripCalls.length;
      if (allEvents === 0) continue; // purely environmental arcs are exempt
      expect(earlyEvents).toBeLessThan(allEvents);
    }
  });

  it('every scenario survives a full shift and a teardown', () => {
    for (const s of build()) {
      expect(() => runScenario(s)).not.toThrow();
    }
  });
});
