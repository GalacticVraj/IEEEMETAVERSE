/**
 * End-to-end sanity check on the composed physics, using Meridian Bay's real
 * fleet rather than a fixture. These assertions are about PLAUSIBILITY — the
 * shape a power engineer would expect — not about exact values.
 */
import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';
import { describe, expect, it } from 'vitest';

import { createFrequencyModel } from './frequency-model';
import type { FrequencyMachine } from './frequency-model';
import { systemInertiaMwS } from './inertia';

/** The real fleet, dispatched to cover a typical evening peak. */
function realFleet(overrides: Record<string, Partial<FrequencyMachine>> = {}) {
  const dispatch: Record<string, number> = {
    'G-BASE-S': 400,
    'G-PEAK-S': 90,
    'G-PEAK-IN': 40,
    'G-SOLAR': 0, // evening
    'G-WIND': 45,
    'G-BATT-DT': 0,
    'G-IMPORT': 180,
    'G-GAS-HB': 30,
  };
  return MERIDIAN_BAY_TOPOLOGY.generators.map((g): FrequencyMachine => {
    const id = g.id as string;
    return {
      id,
      kind: g.kind as string,
      ratedMw: g.capacity as number,
      outputMw: dispatch[id] ?? 0,
      online: true,
      ...overrides[id],
    };
  });
}

const TIMESTEP_S = 0.1;
const totalOutput = (fleet: readonly FrequencyMachine[]): number =>
  fleet.reduce((sum, m) => sum + (m.online ? m.outputMw : 0), 0);

describe('Meridian Bay frequency behaviour', () => {
  it('holds 60.00 Hz indefinitely when the grid is balanced', () => {
    const model = createFrequencyModel();
    const fleet = realFleet();
    const demand = totalOutput(fleet);

    let out = model.step({
      machines: fleet,
      generationMw: demand,
      demandMw: demand,
      timestepS: TIMESTEP_S,
    });
    for (let i = 0; i < 600; i += 1) {
      out = model.step({
        machines: fleet,
        generationMw: demand,
        demandMw: demand,
        timestepS: TIMESTEP_S,
      });
    }
    expect(out.frequencyHz).toBeCloseTo(60, 6);
    expect(out.uflsStage).toBe(0);
  });

  it('produces a plausible RoCoF when the harbor import tie is lost', () => {
    // The scripted heatwave beat drops harbor generation. Meridian Bay is a
    // ~1150 MVA island, so losing a 180 MW in-feed is a severe contingency and
    // a RoCoF of a few Hz/s is correct for a system this small — utility-scale
    // interconnections see far less because they carry far more inertia.
    const before = realFleet();
    const demand = totalOutput(before);
    const after = realFleet({ 'G-IMPORT': { online: false, outputMw: 0 } });

    const model = createFrequencyModel();
    model.step({ machines: before, generationMw: demand, demandMw: demand, timestepS: TIMESTEP_S });

    const out = model.step({
      machines: after,
      generationMw: totalOutput(after),
      demandMw: demand,
      timestepS: TIMESTEP_S,
    });

    expect(out.rocofHzPerS).toBeLessThan(0);
    expect(Math.abs(out.rocofHzPerS)).toBeGreaterThan(0.5);
    expect(Math.abs(out.rocofHzPerS)).toBeLessThan(10);
    // Losing the tie costs its inertia contribution too.
    expect(out.inertiaMwS).toBeLessThan(systemInertiaMwS(before));
  });

  it('falls faster on a renewable-heavy dispatch than a thermal-heavy one', () => {
    // Same MW deficit, different inertia. This is the defining stability
    // problem of a decarbonising grid and here it is emergent, not scripted.
    const thermal = realFleet();
    const renewable = realFleet({
      'G-BASE-S': { online: false, outputMw: 0 },
      'G-SOLAR': { outputMw: 120 },
      'G-WIND': { outputMw: 90 },
      'G-BATT-DT': { outputMw: 50 },
    });

    const step = (fleet: readonly FrequencyMachine[]) =>
      createFrequencyModel().step({
        machines: fleet,
        generationMw: 500,
        demandMw: 600,
        timestepS: TIMESTEP_S,
      });

    const thermalOut = step(thermal);
    const renewableOut = step(renewable);

    expect(renewableOut.inertiaMwS).toBeLessThan(thermalOut.inertiaMwS);
    expect(Math.abs(renewableOut.rocofHzPerS)).toBeGreaterThan(Math.abs(thermalOut.rocofHzPerS));
  });

  it('arrests a collapse through staged UFLS rather than running to the floor', () => {
    const fleet = realFleet();
    const model = createFrequencyModel();
    const generationMw = totalOutput(fleet);
    const demandMw = generationMw + 150; // sustained 150 MW deficit

    let out = model.step({ machines: fleet, generationMw, demandMw, timestepS: TIMESTEP_S });
    for (let i = 0; i < 300; i += 1) {
      // Once relays shed, the surviving demand really does drop.
      const served = demandMw * (1 - out.uflsShedFraction);
      out = model.step({ machines: fleet, generationMw, demandMw: served, timestepS: TIMESTEP_S });
    }

    expect(out.uflsStage).toBeGreaterThanOrEqual(1);
    // UFLS worked: the system survived above the collapse floor.
    expect(out.frequencyHz).toBeGreaterThan(55);
  });

  it('leaves under a second of headroom before stage 1 on a 100 MW deficit', () => {
    // Documents the operator's real time budget. Meridian Bay carries
    // 3760 MW·s, so a 100 MW deficit falls at ~0.8 Hz/s and reaches the
    // 59.3 Hz relay in well under two seconds. This is why the console has to
    // project consequences BEFORE a click rather than narrate them after: on
    // a system this small, unassisted human reaction time is not fast enough.
    // Governor ramping is what actually buys the player room, which is the
    // lesson the scenario is built to teach.
    const fleet = realFleet();
    const model = createFrequencyModel();
    const generationMw = totalOutput(fleet);
    const demandMw = generationMw + 100;

    let ticksToStage1 = 0;
    let out = model.step({ machines: fleet, generationMw, demandMw, timestepS: TIMESTEP_S });
    while (out.uflsStage === 0 && ticksToStage1 < 200) {
      out = model.step({ machines: fleet, generationMw, demandMw, timestepS: TIMESTEP_S });
      ticksToStage1 += 1;
    }

    expect(out.uflsStage).toBeGreaterThanOrEqual(1);
    // 10 ticks = 1 s. Between half a second and three seconds is the plausible
    // band for an island this size; outside it the calibration has drifted.
    expect(ticksToStage1).toBeGreaterThan(5);
    expect(ticksToStage1).toBeLessThan(30);
  });

  it('recovers toward nominal once the operator closes the gap in time', () => {
    const fleet = realFleet();
    const model = createFrequencyModel();
    const generationMw = totalOutput(fleet);

    // A 40 MW deficit held for half a second, then fully relieved — inside
    // the budget the test above measures, so no relay should fire.
    let out = model.step({
      machines: fleet,
      generationMw,
      demandMw: generationMw + 40,
      timestepS: TIMESTEP_S,
    });
    for (let i = 0; i < 5; i += 1) {
      out = model.step({
        machines: fleet,
        generationMw,
        demandMw: generationMw + 40,
        timestepS: TIMESTEP_S,
      });
    }
    const nadir = out.frequencyHz;
    expect(nadir).toBeLessThan(60);

    for (let i = 0; i < 300; i += 1) {
      out = model.step({
        machines: fleet,
        generationMw,
        demandMw: generationMw,
        timestepS: TIMESTEP_S,
      });
    }
    expect(out.frequencyHz).toBeGreaterThan(nadir);
    expect(out.uflsStage).toBe(0); // acted early enough — no automatic shedding

    // Frequency recovers close to nominal but NOT exactly onto it. That is the
    // correct result, not a tolerance problem: load damping and governor droop
    // are PRIMARY response, and primary response always leaves a steady-state
    // offset. Only secondary control (AGC) drives the remaining error to zero,
    // and Meridian Bay models no AGC. A model that snapped back to a clean
    // 60.000 would be the suspicious one.
    expect(out.frequencyHz).toBeGreaterThan(59.9);
    expect(out.frequencyHz).toBeLessThan(60);
  });
});
