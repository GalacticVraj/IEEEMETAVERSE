import { canonicalize, hashString } from '@kernel';

import type { GraphEntities, GraphSnapshot } from '../graph-model';

const byId = <T extends { readonly id: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** Produce a canonical, id-sorted snapshot of the graph (entities + version). */
export function graphToSnapshot(entities: GraphEntities, version: number): GraphSnapshot {
  return {
    version,
    buses: byId(entities.buses),
    substations: byId(entities.substations),
    lines: byId(entities.lines),
    transformers: byId(entities.transformers),
    generators: byId(entities.generators),
    loads: byId(entities.loads),
    breakers: byId(entities.breakers),
  };
}

/** Deterministic serialization (stable key + array ordering). */
export function serializeGraph(snapshot: GraphSnapshot): string {
  return canonicalize(snapshot);
}

/** Inverse of {@link serializeGraph}. */
export function deserializeGraph(text: string): GraphSnapshot {
  return JSON.parse(text) as GraphSnapshot;
}

/**
 * The STRUCTURAL projection used for topology hashing/comparison. It excludes
 * provenance (version, creation/modified ticks, free-form metadata) so that two
 * graphs with the same wiring hash identically regardless of how they were
 * built.
 */
const structural = (entities: GraphEntities): unknown => ({
  buses: byId(entities.buses).map((bus) => ({
    id: bus.id,
    voltage: bus.nominalVoltageKv,
    substation: bus.substationId,
  })),
  substations: byId(entities.substations).map((sub) => ({
    id: sub.id,
    name: sub.name,
    buses: [...sub.busIds].sort(),
  })),
  lines: byId(entities.lines).map((line) => ({
    id: line.id,
    from: line.from,
    to: line.to,
    capacity: line.capacityMw,
    reactance: line.reactancePu,
    breakers: [...line.breakerIds].sort(),
  })),
  transformers: byId(entities.transformers).map((transformer) => ({
    id: transformer.id,
    from: transformer.from,
    to: transformer.to,
    ratio: transformer.turnsRatio,
  })),
  generators: byId(entities.generators).map((generator) => ({
    id: generator.id,
    bus: generator.busId,
    capacity: generator.capacityMw,
    kind: generator.generationKind,
  })),
  loads: byId(entities.loads).map((load) => ({
    id: load.id,
    bus: load.busId,
    demand: load.nominalDemandMw,
    critical: load.critical,
  })),
  breakers: byId(entities.breakers).map((breaker) => ({
    id: breaker.id,
    line: breaker.lineId,
    bus: breaker.busId,
    state: breaker.state,
    normallyClosed: breaker.normallyClosed,
  })),
});

/** Deterministic structural hash of the topology (provenance-independent). */
export function topologyHash(entities: GraphEntities): string {
  return hashString(canonicalize(structural(entities)));
}

/** True if two graphs are structurally identical. */
export function compareTopology(a: GraphEntities, b: GraphEntities): boolean {
  return topologyHash(a) === topologyHash(b);
}
