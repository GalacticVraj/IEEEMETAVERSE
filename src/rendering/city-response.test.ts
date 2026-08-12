import { asGeneratorId, asMegaWatts, asZoneId } from '@app-types';
import type { GeneratorStatus, ZoneStatus } from '@engine/model/grid';
import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';
import { describe, expect, it } from 'vitest';

import {
  CITY_ASSET_GENERATOR,
  cityResponseSignature,
  deriveCityResponse,
  zoneNominalDemand,
} from './city-response';

const zone = (
  id: string,
  state: ZoneStatus['state'],
  served: number,
  unserved: number,
): ZoneStatus => ({
  zone: asZoneId(id),
  state,
  servedLoad: asMegaWatts(served),
  unservedLoad: asMegaWatts(unserved),
});

const gen = (id: string, output: number, capacity: number, tripped = false): GeneratorStatus => ({
  id: asGeneratorId(id),
  outputMw: asMegaWatts(output),
  capacityMw: asMegaWatts(capacity),
  tripped,
});

describe('zoneNominalDemand', () => {
  it('sums the topology load table per zone', () => {
    const nominal = zoneNominalDemand();
    // DT carries LD-DT-COM 80 + LD-DT-HOSP 20 + LD-DT-RET 40 + LD-DT-MIX 35.
    expect(nominal['DT']).toBe(175);
    expect(nominal['IN']).toBeGreaterThan(0);
  });

  it('covers every zone the topology declares, including the harbor', () => {
    const nominal = zoneNominalDemand();
    for (const id of ['DT', 'IN', 'RN', 'RS', 'AP', 'HB']) {
      expect(nominal[id]).toBeGreaterThan(0);
    }
  });
});

describe('deriveCityResponse — zone dimming follows served load, not decision history', () => {
  it('reports a fully served zone at full brightness', () => {
    const nominal = { DT: 175 };
    const r = deriveCityResponse([zone('DT', 'Powered', 175, 0)], [], nominal);
    expect(r.zoneLoadFactor['DT']).toBeCloseTo(1);
    expect(r.darkZones.has('DT')).toBe(false);
  });

  it('dims a zone in proportion to how much load was shed', () => {
    const nominal = { DT: 175 };
    const r = deriveCityResponse([zone('DT', 'Powered', 87.5, 0)], [], nominal);
    expect(r.zoneLoadFactor['DT']).toBeCloseTo(0.5);
  });

  it('marks a blacked-out zone dark with zero load factor', () => {
    const nominal = { DT: 175 };
    const r = deriveCityResponse([zone('DT', 'Blackout', 0, 175)], [], nominal);
    expect(r.darkZones.has('DT')).toBe(true);
    expect(r.zoneLoadFactor['DT']).toBe(0);
  });

  it('RESTORES brightness once load comes back — shedding must not latch forever', () => {
    const nominal = { DT: 175 };
    const shed = deriveCityResponse([zone('DT', 'Powered', 70, 0)], [], nominal);
    expect(shed.zoneLoadFactor['DT']).toBeLessThan(0.5);

    const restored = deriveCityResponse([zone('DT', 'Powered', 175, 0)], [], nominal);
    expect(restored.zoneLoadFactor['DT']).toBeCloseTo(1);
  });

  it('clamps above nominal — a heatwave peak is not "brighter than lit"', () => {
    const nominal = { DT: 175 };
    const r = deriveCityResponse([zone('DT', 'Powered', 240, 0)], [], nominal);
    expect(r.zoneLoadFactor['DT']).toBe(1);
  });
});

describe('deriveCityResponse — generator-backed visuals use real topology ids', () => {
  it('maps every city generator asset to a generator that exists in the topology', () => {
    const known = new Set(MERIDIAN_BAY_TOPOLOGY.generators.map((g) => g.id as string));
    for (const [asset, generatorId] of Object.entries(CITY_ASSET_GENERATOR)) {
      expect(known.has(generatorId), `${asset} → ${generatorId}`).toBe(true);
    }
  });

  it('flags the thermal plant as tripped when its real generator trips', () => {
    const r = deriveCityResponse([], [gen('G-BASE-S', 0, 400, true)], {});
    expect(r.trippedAssets.has('GEN-Thermal1')).toBe(true);
  });

  it('does not flag the thermal plant while its generator is running', () => {
    const r = deriveCityResponse([], [gen('G-BASE-S', 320, 400)], {});
    expect(r.trippedAssets.has('GEN-Thermal1')).toBe(false);
  });

  it('drives the solar farm from real solar output — dark at night', () => {
    const night = deriveCityResponse([], [gen('G-SOLAR', 0, 120)], {});
    expect(night.assetOutputFactor['RN-Solar']).toBe(0);

    const noon = deriveCityResponse([], [gen('G-SOLAR', 120, 120)], {});
    expect(noon.assetOutputFactor['RN-Solar']).toBeCloseTo(1);
  });

  it('drives battery storage from real storage output rather than a never-true string match', () => {
    const idle = deriveCityResponse([], [gen('G-BATT-DT', 0, 50)], {});
    expect(idle.assetOutputFactor['BESS-1']).toBe(0);

    const discharging = deriveCityResponse([], [gen('G-BATT-DT', 25, 50)], {});
    expect(discharging.assetOutputFactor['BESS-1']).toBeCloseTo(0.5);
    expect(discharging.assetOutputFactor['BESS-2']).toBeCloseTo(0.5);
  });

  it('drives wind turbine spin from real wind output', () => {
    const calm = deriveCityResponse([], [gen('G-WIND', 0, 90)], {});
    expect(calm.assetOutputFactor['GEN-Wind1']).toBe(0);

    const gusty = deriveCityResponse([], [gen('G-WIND', 90, 90)], {});
    expect(gusty.assetOutputFactor['GEN-Wind1']).toBeCloseTo(1);
  });

  it('reports zero output for a generator the projection has not sent yet', () => {
    const r = deriveCityResponse([], [], {});
    expect(r.assetOutputFactor['RN-Solar']).toBe(0);
    expect(r.trippedAssets.has('GEN-Thermal1')).toBe(false);
  });
});

describe('cityResponseSignature — keeps the city tree from reconciling every tick', () => {
  it('is stable while nothing visible changes', () => {
    const zones = [zone('DT', 'Powered', 175, 0)];
    const gens = [gen('G-SOLAR', 60, 120)];
    expect(cityResponseSignature(zones, gens)).toBe(cityResponseSignature(zones, gens));
  });

  it('ignores load jitter far below what an eye can see', () => {
    const gens = [gen('G-SOLAR', 60, 120)];
    const a = cityResponseSignature([zone('DT', 'Powered', 175, 0)], gens);
    const b = cityResponseSignature([zone('DT', 'Powered', 174.2, 0.8)], gens);
    expect(a).toBe(b);
  });

  it('changes when a zone goes dark', () => {
    const gens: GeneratorStatus[] = [];
    const lit = cityResponseSignature([zone('DT', 'Powered', 175, 0)], gens);
    const dark = cityResponseSignature([zone('DT', 'Blackout', 0, 175)], gens);
    expect(lit).not.toBe(dark);
  });

  it('changes when a meaningful amount of load is shed', () => {
    const gens: GeneratorStatus[] = [];
    const full = cityResponseSignature([zone('DT', 'Powered', 175, 0)], gens);
    const shed = cityResponseSignature([zone('DT', 'Powered', 88, 0)], gens);
    expect(full).not.toBe(shed);
  });

  it('changes when a generator trips', () => {
    const zones = [zone('DT', 'Powered', 175, 0)];
    const running = cityResponseSignature(zones, [gen('G-BASE-S', 320, 400)]);
    const tripped = cityResponseSignature(zones, [gen('G-BASE-S', 0, 400, true)]);
    expect(running).not.toBe(tripped);
  });
});

describe('deriveCityResponse — hospital priority', () => {
  it('is not prioritized while downtown is fully powered', () => {
    const r = deriveCityResponse([zone('DT', 'Powered', 175, 0)], [], { DT: 175 });
    expect(r.hospitalPrioritized).toBe(false);
  });

  it('is prioritized once downtown degrades — the critical load is being protected', () => {
    const r = deriveCityResponse([zone('DT', 'Degraded', 90, 85)], [], { DT: 175 });
    expect(r.hospitalPrioritized).toBe(true);
  });

  it('is prioritized during a downtown blackout', () => {
    const r = deriveCityResponse([zone('DT', 'Blackout', 0, 175)], [], { DT: 175 });
    expect(r.hospitalPrioritized).toBe(true);
  });
});
