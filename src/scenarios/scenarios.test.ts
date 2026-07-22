/**
 * Scenario integration tests.
 *
 * Each scenario is instantiated, setup() called, then onTick() is called
 * for 120 ticks (enough to trigger all scripted faults). Tests verify:
 *   1. No exception is thrown during setup or any tick.
 *   2. teardown() completes without throwing.
 *   3. The fault API calls are routed correctly (mock verification).
 */
import { asGeneratorId, asLineId, asLoadId } from '@app-types';
import type { GeneratorId, LineId, LoadId, Seconds } from '@app-types';
import type { TickContext } from '@core';
import { describe, expect, it, vi } from 'vitest';

import type { ICrisisScenario, ScenarioContext, ScenarioFaultApi } from './crisis-scenario';
import { CyberAttackScenario } from './cyber-attack/cyber-attack-scenario';
import { DemandSurgeScenario } from './demand-surge/demand-surge-scenario';
import { EquipmentFailureScenario } from './equipment-failure/equipment-failure-scenario';
import { GeneratorLossScenario } from './generator-loss/generator-loss-scenario';
import { HeatwaveScenario } from './heatwave/heatwave-scenario';
import { StormScenario } from './storm/storm-scenario';
import { SubstationFailureScenario } from './substation-failure/substation-failure-scenario';
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
    get _resetCalls() { return _resetCalls; },
    tripGenerator(id: GeneratorId) { _tripCalls.push(id); },
    untripGenerator(id: GeneratorId) { _untripCalls.push(id); },
    shedLoad(id: LoadId, fraction: number) { _shedCalls.push([id, fraction]); },
    resetShedding() { _resetCalls++; },
    commandOpenLine(line: LineId) { _openCalls.push(line); },
  };
}

function makeScenarioContext(faults: ScenarioFaultApi): ScenarioContext {
  return {
    engine: {
      id: 'simulation-engine' as any,
      getState: () => ({} as any),
      init: vi.fn(),
      step: vi.fn(),
      reset: vi.fn(),
      dispose: vi.fn(),
    },
    faults,
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
 */
function runScenario(
  scenario: ICrisisScenario,
  ticks = 120,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HeatwaveScenario', () => {
  it('does not throw over 120 ticks', () => {
    expect(() => runScenario(new HeatwaveScenario())).not.toThrow();
  });

  it('trips G-BASE-S at tick 60', () => {
    const faults = runScenario(new HeatwaveScenario());
    expect(faults._tripCalls).toContain(asGeneratorId('G-BASE-S'));
  });

  it('trips G-GAS-HB at tick 80', () => {
    const faults = runScenario(new HeatwaveScenario());
    expect(faults._tripCalls).toContain(asGeneratorId('G-GAS-HB'));
  });

  it('applies industrial load shedding at tick 100', () => {
    const faults = runScenario(new HeatwaveScenario());
    expect(faults._shedCalls.some(([id]) => id === asLoadId('LD-IN-HVY'))).toBe(true);
  });

  it('untrips all generators on teardown', () => {
    const faults = runScenario(new HeatwaveScenario());
    expect(faults._untripCalls).toContain(asGeneratorId('G-BASE-S'));
    expect(faults._untripCalls).toContain(asGeneratorId('G-GAS-HB'));
  });
});

describe('StormScenario', () => {
  it('does not throw over 120 ticks', () => {
    expect(() => runScenario(new StormScenario())).not.toThrow();
  });

  it('opens GN1-DT1 at tick 30', () => {
    const faults = runScenario(new StormScenario());
    expect(faults._openCalls).toContain(asLineId('GN1-DT1'));
  });

  it('opens HB1-HB2 at tick 50', () => {
    const faults = runScenario(new StormScenario());
    expect(faults._openCalls).toContain(asLineId('HB1-HB2'));
  });

  it('trips G-WIND at tick 80', () => {
    const faults = runScenario(new StormScenario());
    expect(faults._tripCalls).toContain(asGeneratorId('G-WIND'));
  });
});

describe('EquipmentFailureScenario', () => {
  it('does not throw over 120 ticks', () => {
    expect(() => runScenario(new EquipmentFailureScenario())).not.toThrow();
  });

  it('opens DT4-HB1 at tick 20', () => {
    const faults = runScenario(new EquipmentFailureScenario());
    expect(faults._openCalls).toContain(asLineId('DT4-HB1'));
  });

  it('opens IN1-HB1 at tick 40', () => {
    const faults = runScenario(new EquipmentFailureScenario());
    expect(faults._openCalls).toContain(asLineId('IN1-HB1'));
  });

  it('opens DT1-IN1 at tick 60', () => {
    const faults = runScenario(new EquipmentFailureScenario());
    expect(faults._openCalls).toContain(asLineId('DT1-IN1'));
  });

  it('triggers exactly 3 line opens total', () => {
    const faults = runScenario(new EquipmentFailureScenario());
    expect(faults._openCalls).toHaveLength(3);
  });
});

describe('CyberAttackScenario', () => {
  it('does not throw over 120 ticks', () => {
    expect(() => runScenario(new CyberAttackScenario())).not.toThrow();
  });

  it('opens GS1-DT1 at tick 40', () => {
    const faults = runScenario(new CyberAttackScenario());
    expect(faults._openCalls).toContain(asLineId('GS1-DT1'));
  });

  it('trips G-IMPORT at tick 70', () => {
    const faults = runScenario(new CyberAttackScenario());
    expect(faults._tripCalls).toContain(asGeneratorId('G-IMPORT'));
  });

  it('applies UFLS shedding at tick 85', () => {
    const faults = runScenario(new CyberAttackScenario());
    expect(faults._shedCalls.length).toBeGreaterThan(0);
  });
});

describe('GeneratorLossScenario', () => {
  it('does not throw over 120 ticks', () => {
    expect(() => runScenario(new GeneratorLossScenario())).not.toThrow();
  });

  it('trips both G-BASE-S and G-PEAK-S at tick 25', () => {
    const faults = runScenario(new GeneratorLossScenario());
    expect(faults._tripCalls).toContain(asGeneratorId('G-BASE-S'));
    expect(faults._tripCalls).toContain(asGeneratorId('G-PEAK-S'));
  });

  it('applies load shedding at tick 65', () => {
    const faults = runScenario(new GeneratorLossScenario());
    expect(faults._shedCalls.length).toBeGreaterThan(0);
  });

  it('untrips all generators on teardown', () => {
    const faults = runScenario(new GeneratorLossScenario());
    expect(faults._untripCalls).toContain(asGeneratorId('G-BASE-S'));
    expect(faults._untripCalls).toContain(asGeneratorId('G-PEAK-S'));
  });
});

describe('SubstationFailureScenario', () => {
  it('does not throw over 120 ticks', () => {
    expect(() => runScenario(new SubstationFailureScenario())).not.toThrow();
  });

  it('opens all three IN2 breakers at tick 35', () => {
    const faults = runScenario(new SubstationFailureScenario());
    expect(faults._openCalls).toContain(asLineId('IN1-IN2'));
    expect(faults._openCalls).toContain(asLineId('IN2-IN3'));
    expect(faults._openCalls).toContain(asLineId('IN2-RS1'));
  });
});

describe('DemandSurgeScenario', () => {
  it('does not throw over 120 ticks', () => {
    expect(() => runScenario(new DemandSurgeScenario())).not.toThrow();
  });

  it('applies demand response shedding at tick 80', () => {
    const faults = runScenario(new DemandSurgeScenario());
    expect(faults._shedCalls.some(([id]) => id === asLoadId('LD-RN-A'))).toBe(true);
  });

  it('resets shedding on teardown', () => {
    const faults = runScenario(new DemandSurgeScenario());
    expect(faults._resetCalls).toBeGreaterThan(0);
  });
});

describe('TransformerFailureScenario', () => {
  it('does not throw over 120 ticks', () => {
    expect(() => runScenario(new TransformerFailureScenario())).not.toThrow();
  });

  it('opens GS1-DT1, GS1-IN1, GS1-RS1 at tick 45', () => {
    const faults = runScenario(new TransformerFailureScenario());
    expect(faults._openCalls).toContain(asLineId('GS1-DT1'));
    expect(faults._openCalls).toContain(asLineId('GS1-IN1'));
    expect(faults._openCalls).toContain(asLineId('GS1-RS1'));
  });

  it('trips islanded generators at tick 55', () => {
    const faults = runScenario(new TransformerFailureScenario());
    expect(faults._tripCalls).toContain(asGeneratorId('G-BASE-S'));
    expect(faults._tripCalls).toContain(asGeneratorId('G-PEAK-S'));
  });

  it('applies emergency load shedding at tick 80', () => {
    const faults = runScenario(new TransformerFailureScenario());
    expect(faults._shedCalls.some(([id]) => id === asLoadId('LD-IN-HVY'))).toBe(true);
  });
});

describe('Scenario registry invariants', () => {
  const allScenarios: ICrisisScenario[] = [
    new HeatwaveScenario(),
    new StormScenario(),
    new EquipmentFailureScenario(),
    new CyberAttackScenario(),
    new GeneratorLossScenario(),
    new SubstationFailureScenario(),
    new DemandSurgeScenario(),
    new TransformerFailureScenario(),
  ];

  it('all scenarios have unique IDs', () => {
    const ids = allScenarios.map((s) => s.metadata.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all scenarios have non-empty name and summary', () => {
    for (const s of allScenarios) {
      expect(s.metadata.name.length).toBeGreaterThan(0);
      expect(s.metadata.summary.length).toBeGreaterThan(0);
    }
  });

  it('each scenario can be set up and run 20 ticks without exception', () => {
    for (const s of allScenarios) {
      expect(() => runScenario(s, 20)).not.toThrow();
    }
  });
});
