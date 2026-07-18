import type { BusId } from '@app-types';
import type { KernelEventMap } from '@core';

import type { EntityKind } from './entities/entity';

/*
 * Topology events. `TopologyEventMap` EXTENDS the kernel's `KernelEventMap`, so
 * topology events flow on any kernel-compatible bus while the kernel itself
 * never references them. Every mutation transaction emits a deterministic
 * sequence of these. All payloads are documented below.
 */

/** A new empty graph was created. */
export interface GraphCreatedPayload {
  readonly version: number;
  readonly hash: string;
}

/** A bus (graph node) was added. */
export interface NodeAddedPayload {
  readonly busId: BusId;
  readonly tick: number;
}

/** A bus (graph node) was removed. */
export interface NodeRemovedPayload {
  readonly busId: BusId;
  readonly tick: number;
}

/** An edge (line or transformer) was added. */
export interface EdgeAddedPayload {
  readonly edgeId: string;
  readonly from: BusId;
  readonly to: BusId;
  readonly tick: number;
}

/** An edge was removed. */
export interface EdgeRemovedPayload {
  readonly edgeId: string;
  readonly tick: number;
}

/** The topology changed (emitted once per committed transaction). */
export interface TopologyChangedPayload {
  readonly version: number;
  readonly hash: string;
  readonly tick: number;
}

/** The number of electrical islands increased (a split occurred). */
export interface IslandDetectedPayload {
  readonly islandCount: number;
  readonly tick: number;
}

/** The number of electrical islands decreased (islands merged/recovered). */
export interface IslandRecoveredPayload {
  readonly islandCount: number;
  readonly tick: number;
}

/** An existing entity's metadata/version was updated. */
export interface EntityUpdatedPayload {
  readonly entityId: string;
  readonly kind: EntityKind;
  readonly version: number;
  readonly tick: number;
}

/** A commit passed validation. */
export interface ValidationPassedPayload {
  readonly checks: number;
  readonly tick: number;
}

/** A commit failed validation (the transaction was rejected, nothing applied). */
export interface ValidationFailedPayload {
  readonly issueCount: number;
  readonly tick: number;
}

export interface TopologyEventMap extends KernelEventMap {
  GraphCreated: GraphCreatedPayload;
  NodeAdded: NodeAddedPayload;
  NodeRemoved: NodeRemovedPayload;
  EdgeAdded: EdgeAddedPayload;
  EdgeRemoved: EdgeRemovedPayload;
  TopologyChanged: TopologyChangedPayload;
  IslandDetected: IslandDetectedPayload;
  IslandRecovered: IslandRecoveredPayload;
  EntityUpdated: EntityUpdatedPayload;
  ValidationPassed: ValidationPassedPayload;
  ValidationFailed: ValidationFailedPayload;
}

export const TOPOLOGY_EVENT = {
  GraphCreated: 'GraphCreated',
  NodeAdded: 'NodeAdded',
  NodeRemoved: 'NodeRemoved',
  EdgeAdded: 'EdgeAdded',
  EdgeRemoved: 'EdgeRemoved',
  TopologyChanged: 'TopologyChanged',
  IslandDetected: 'IslandDetected',
  IslandRecovered: 'IslandRecovered',
  EntityUpdated: 'EntityUpdated',
  ValidationPassed: 'ValidationPassed',
  ValidationFailed: 'ValidationFailed',
} as const;

export type TopologyEventName = (typeof TOPOLOGY_EVENT)[keyof typeof TOPOLOGY_EVENT];
