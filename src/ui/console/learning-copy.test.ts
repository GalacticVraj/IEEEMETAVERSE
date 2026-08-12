import { BUILDING_POSITIONS } from '@rendering/camera/city-positions';
import { describe, expect, it } from 'vitest';

import { buildingNote, zoneDisplayName, zoneOfBuilding } from './learning-copy';

/**
 * Every id the 3D city can hand to `selectAsset({ kind: 'building' })` has to
 * resolve to a real zone. The id-prefix heuristic silently produced "SUB", "GEN"
 * and "BESS" for the infrastructure assets, so their inspector card reported
 * POWERED even mid-blackout.
 */
describe('zoneOfBuilding', () => {
  it('resolves district buildings from their id prefix', () => {
    expect(zoneOfBuilding('DT-Corp1')).toBe('DT');
    expect(zoneOfBuilding('RN-House3')).toBe('RN');
    expect(zoneOfBuilding('RS-Apt2')).toBe('RS');
  });

  it('resolves substations to the district they feed', () => {
    expect(zoneOfBuilding('SUB-DT')).toBe('DT');
    expect(zoneOfBuilding('SUB-IN')).toBe('IN');
    expect(zoneOfBuilding('SUB-RN')).toBe('RN');
    expect(zoneOfBuilding('SUB-RS')).toBe('RS');
  });

  it('resolves generation and storage assets to their real district', () => {
    expect(zoneOfBuilding('GEN-Thermal1')).toBe('IN');
    expect(zoneOfBuilding('GEN-Wind1')).toBe('RN');
    expect(zoneOfBuilding('GEN-Wind2')).toBe('RN');
    expect(zoneOfBuilding('BESS-1')).toBe('RN');
    expect(zoneOfBuilding('BESS-2')).toBe('DT');
  });

  it('gives every placed building a zone with a real display name', () => {
    for (const id of Object.keys(BUILDING_POSITIONS)) {
      const zone = zoneOfBuilding(id);
      expect(zoneDisplayName(zone), `${id} → ${zone}`).not.toBe(zone);
    }
  });
});

describe('buildingNote', () => {
  it('names the infrastructure assets instead of falling back to "City structure"', () => {
    for (const id of ['SUB-DT', 'BESS-1', 'GEN-Wind1', 'GEN-Thermal1', 'RN-Solar']) {
      expect(buildingNote(id).name, id).not.toBe(id);
      expect(buildingNote(id).role, id).not.toBe('City structure');
    }
  });
});
