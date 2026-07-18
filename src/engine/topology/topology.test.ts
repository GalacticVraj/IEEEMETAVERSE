import { describe, expect, it } from 'vitest';

import { MeridianBayTopologyService } from './topology';

describe('MeridianBayTopologyService', () => {
  it('returns the static Meridian Bay topology', () => {
    const service = new MeridianBayTopologyService();
    const topology = service.get();

    expect(topology.nodes).toHaveLength(20);
    expect(topology.lines).toHaveLength(30);
    expect(topology.generators).toHaveLength(8);
    expect(topology.loads).toHaveLength(18);
    expect(topology.zones).toHaveLength(6);
  });

  it('contains critical loads', () => {
    const service = new MeridianBayTopologyService();
    const topology = service.get();

    const criticalLoads = topology.loads.filter((l) => l.critical);
    expect(criticalLoads).toHaveLength(3); // Hospital, Emergency ATC, Water Treatment

    const hospital = criticalLoads.find((l) => l.id === 'LD-DT-HOSP');
    expect(hospital).toBeDefined();
    expect(hospital?.node).toBe('DT3');
    expect(hospital?.zone).toBe('DT');
  });

  it('sets up generators correctly', () => {
    const service = new MeridianBayTopologyService();
    const topology = service.get();

    const baseload = topology.generators.find((g) => g.id === 'G-BASE-S');
    expect(baseload).toBeDefined();
    expect(baseload?.kind).toBe('Baseload');
    expect(baseload?.capacity).toBe(400);
  });
});
