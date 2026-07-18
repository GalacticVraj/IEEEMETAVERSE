import { createToken } from '@core';
import type { Token } from '@core';

import type { GridTopology } from '../model/grid';
import { MERIDIAN_BAY_TOPOLOGY } from './meridian-bay';

/** Provides the static electrical topology for the active scenario. */
export interface ITopologyService {
  /** The current wiring diagram (nodes, lines, generators, loads, zones). */
  get(): GridTopology;
}

export const TOPOLOGY_SERVICE: Token<ITopologyService> = createToken('TopologyService');

/**
 * Topology service returning the Meridian Bay grid topology.
 */
export class MeridianBayTopologyService implements ITopologyService {
  public get(): GridTopology {
    return MERIDIAN_BAY_TOPOLOGY;
  }
}

