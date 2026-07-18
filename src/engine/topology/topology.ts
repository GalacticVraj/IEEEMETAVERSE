import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

import type { GridTopology } from '../model/grid';

/** Provides the static electrical topology for the active scenario. */
export interface ITopologyService {
  /** The current wiring diagram (nodes, lines, generators, loads, zones). */
  get(): GridTopology;
}

export const TOPOLOGY_SERVICE: Token<ITopologyService> = createToken('TopologyService');

/**
 * Placeholder topology service.
 *
 * PHASE 2 will build Meridian Bay procedurally from a seed: generate zones,
 * place substations/nodes, wire transmission lines with realistic capacities
 * and reactances, and site generators and loads (including critical loads).
 */
export class PlaceholderTopologyService implements ITopologyService {
  public get(): GridTopology {
    return notImplemented(
      'TopologyService.get',
      'Procedurally generate the Meridian Bay grid topology from the scenario seed.',
    );
  }
}
