import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';
import { describe, expect, it } from 'vitest';

import { BUILDING_POSITIONS, buildingPosition3 } from './city-positions';

/**
 * The simulation and the city have to agree on what exists. The harbor is the
 * sharpest case: the scripted heatwave beat trips harbor generation, and the
 * district had no geometry at all — the most dramatic moment of the run
 * happened somewhere the player could not look at.
 */
describe('BUILDING_POSITIONS covers the simulated city', () => {
  it('places every building the topology declares', () => {
    const missing: string[] = [];
    for (const zone of MERIDIAN_BAY_TOPOLOGY.zones) {
      for (const buildingId of zone.buildingIds) {
        if (BUILDING_POSITIONS[buildingId] === undefined) {
          missing.push(`${zone.id as string}/${buildingId}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('places at least one building in every zone, harbor included', () => {
    for (const zone of MERIDIAN_BAY_TOPOLOGY.zones) {
      const placed = zone.buildingIds.filter((b) => BUILDING_POSITIONS[b] !== undefined);
      expect(placed.length, `zone ${zone.id as string}`).toBeGreaterThan(0);
    }
  });

  it('keeps every placed building inside the 180x180 world footprint', () => {
    for (const [id, [x, z]] of Object.entries(BUILDING_POSITIONS)) {
      expect(Math.abs(x), `${id} x`).toBeLessThanOrEqual(90);
      expect(Math.abs(z), `${id} z`).toBeLessThanOrEqual(90);
    }
  });

  it('returns a ground-level triple for a known building and null otherwise', () => {
    expect(buildingPosition3('DT-Hosp')).toEqual([30, 0, 68]);
    expect(buildingPosition3('nope')).toBeNull();
  });
});
