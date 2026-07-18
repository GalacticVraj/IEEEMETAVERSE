import type {
  BreakerId,
  BusId,
  GeneratorId,
  LineId,
  LoadId,
  SubstationId,
  TransformerId,
} from '@app-types';
import { GridGuardError, createToken } from '@core';
import type { Token, TypedEventBus } from '@core';

import {
  buildAdjacency,
  connectedComponents,
  reachableFrom,
  shortestPath,
} from './algorithms/traversal';
import {
  createBreaker,
  createBus,
  createGenerator,
  createLoad,
  createSubstation,
  createTransformer,
  createTransmissionLine,
} from './entities/electrical-entities';
import type {
  Breaker,
  BreakerSpec,
  Bus,
  BusSpec,
  Generator,
  GeneratorSpec,
  GraphEdge,
  Load,
  LoadSpec,
  Substation,
  SubstationSpec,
  Transformer,
  TransformerSpec,
  TransmissionLine,
  TransmissionLineSpec,
} from './entities/electrical-entities';
import { touchMeta } from './entities/entity';
import type { EntityKind, EntityMeta } from './entities/entity';
import { TOPOLOGY_EVENT } from './graph-events';
import type { TopologyEventMap } from './graph-events';
import type { GraphDiagnostics, GraphEntities, GraphSnapshot } from './graph-model';
import { graphToSnapshot, topologyHash } from './serialization/graph-serializer';
import { validateGraph } from './validation/validator';
import type { GraphValidationReport } from './validation/validator';

/** Thrown when a mutation fails validation. Carries the structured report. */
export class GraphValidationError extends GridGuardError {
  public constructor(public readonly report: GraphValidationReport) {
    super(`Graph validation failed: ${report.errorCount} error(s)`);
  }
}

/** Staged, transaction-style mutation API. No entity mutates itself. */
export interface GraphTransaction {
  addBus(spec: BusSpec): BusId;
  removeBus(id: BusId): void;
  addSubstation(spec: SubstationSpec): SubstationId;
  removeSubstation(id: SubstationId): void;
  addLine(spec: TransmissionLineSpec): LineId;
  removeLine(id: LineId): void;
  replaceLine(id: LineId, spec: TransmissionLineSpec): LineId;
  addTransformer(spec: TransformerSpec): TransformerId;
  removeTransformer(id: TransformerId): void;
  addGenerator(spec: GeneratorSpec): GeneratorId;
  removeGenerator(id: GeneratorId): void;
  addLoad(spec: LoadSpec): LoadId;
  removeLoad(id: LoadId): void;
  addBreaker(spec: BreakerSpec): BreakerId;
  removeBreaker(id: BreakerId): void;
  /** Update an entity's free-form metadata, bumping its version. */
  updateMetadata(id: string, metadata: Readonly<Record<string, unknown>>): void;
}

export interface RecordedTopologyEvent {
  readonly name: string;
  readonly payload: unknown;
}

export interface MutationResult {
  readonly version: number;
  readonly hash: string;
  readonly events: readonly RecordedTopologyEvent[];
  readonly report: GraphValidationReport;
}

export interface ElectricalGraph {
  readonly version: number;
  readonly hash: string;

  getBus(id: BusId): Bus | undefined;
  getSubstation(id: SubstationId): Substation | undefined;
  getLine(id: LineId): TransmissionLine | undefined;
  getTransformer(id: TransformerId): Transformer | undefined;
  getGenerator(id: GeneratorId): Generator | undefined;
  getLoad(id: LoadId): Load | undefined;
  getBreaker(id: BreakerId): Breaker | undefined;

  buses(): readonly Bus[];
  substations(): readonly Substation[];
  lines(): readonly TransmissionLine[];
  transformers(): readonly Transformer[];
  generators(): readonly Generator[];
  loads(): readonly Load[];
  breakers(): readonly Breaker[];
  edges(): readonly GraphEdge[];

  neighbors(bus: BusId): readonly BusId[];
  generatorsAt(bus: BusId): readonly Generator[];
  loadsAt(bus: BusId): readonly Load[];
  breakersOf(line: LineId): readonly Breaker[];
  reachable(from: BusId): ReadonlySet<BusId>;
  shortestPath(from: BusId, to: BusId): readonly BusId[] | null;
  islands(): readonly (readonly BusId[])[];
  islandOf(bus: BusId): readonly BusId[] | null;
  islandCount(): number;
  /** Buses that host a generator (energization sources). */
  sources(): readonly BusId[];

  mutate(recipe: (tx: GraphTransaction) => void): MutationResult;

  entities(): GraphEntities;
  toSnapshot(): GraphSnapshot;
  validate(): GraphValidationReport;
  diagnostics(): GraphDiagnostics;
}

export interface ElectricalGraphOptions<TEvents extends TopologyEventMap = TopologyEventMap> {
  /** Optional bus to emit topology events on. */
  readonly events?: TypedEventBus<TEvents>;
  /** Current tick source for entity provenance. Defaults to 0. */
  readonly now?: () => number;
}

/** DI token for the authoritative electrical graph. */
export const ELECTRICAL_GRAPH: Token<ElectricalGraph> = createToken('ElectricalGraph');

interface GraphMaps {
  buses: Map<BusId, Bus>;
  substations: Map<SubstationId, Substation>;
  lines: Map<LineId, TransmissionLine>;
  transformers: Map<TransformerId, Transformer>;
  generators: Map<GeneratorId, Generator>;
  loads: Map<LoadId, Load>;
  breakers: Map<BreakerId, Breaker>;
}

const emptyMaps = (): GraphMaps => ({
  buses: new Map(),
  substations: new Map(),
  lines: new Map(),
  transformers: new Map(),
  generators: new Map(),
  loads: new Map(),
  breakers: new Map(),
});

const cloneMaps = (maps: GraphMaps): GraphMaps => ({
  buses: new Map(maps.buses),
  substations: new Map(maps.substations),
  lines: new Map(maps.lines),
  transformers: new Map(maps.transformers),
  generators: new Map(maps.generators),
  loads: new Map(maps.loads),
  breakers: new Map(maps.breakers),
});

const sortById = <T extends { readonly id: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

const entitiesOf = (maps: GraphMaps): GraphEntities => ({
  buses: [...maps.buses.values()],
  substations: [...maps.substations.values()],
  lines: [...maps.lines.values()],
  transformers: [...maps.transformers.values()],
  generators: [...maps.generators.values()],
  loads: [...maps.loads.values()],
  breakers: [...maps.breakers.values()],
});

const edgeRefsOf = (maps: GraphMaps): { id: string; from: BusId; to: BusId }[] =>
  [...maps.lines.values(), ...maps.transformers.values()].map((edge) => ({
    id: edge.id,
    from: edge.from,
    to: edge.to,
  }));

const updateInMap = <
  K extends string,
  V extends EntityMeta & { readonly id: K; readonly kind: EntityKind },
>(
  map: Map<K, V>,
  id: string,
  tick: number,
  metadata: Readonly<Record<string, unknown>>,
): V | null => {
  const key = id as K;
  const entity = map.get(key);
  if (entity === undefined) return null;
  const updated: V = { ...entity, ...touchMeta(entity, tick, metadata) };
  map.set(key, updated);
  return updated;
};

export function createElectricalGraph<TEvents extends TopologyEventMap = TopologyEventMap>(
  options: ElectricalGraphOptions<TEvents> = {},
): ElectricalGraph {
  const now = options.now ?? ((): number => 0);
  const eventBus = options.events;
  const emit = (name: string, payload: unknown): void => {
    if (eventBus !== undefined) {
      (eventBus as unknown as { emit(n: string, p: unknown): void }).emit(name, payload);
    }
  };

  let maps = emptyMaps();
  let version = 0;
  let hash = '';
  let cachedAdjacency = new Map<BusId, BusId[]>();
  let cachedIslands: BusId[][] = [];

  const recompute = (): void => {
    hash = topologyHash(entitiesOf(maps));
    const busIds = [...maps.buses.keys()];
    const edges = edgeRefsOf(maps);
    cachedAdjacency = buildAdjacency(busIds, edges);
    cachedIslands = connectedComponents(busIds, edges);
  };
  recompute();
  emit(TOPOLOGY_EVENT.GraphCreated, { version, hash });

  const graph: ElectricalGraph = {
    get version(): number {
      return version;
    },
    get hash(): string {
      return hash;
    },

    getBus: (id) => maps.buses.get(id),
    getSubstation: (id) => maps.substations.get(id),
    getLine: (id) => maps.lines.get(id),
    getTransformer: (id) => maps.transformers.get(id),
    getGenerator: (id) => maps.generators.get(id),
    getLoad: (id) => maps.loads.get(id),
    getBreaker: (id) => maps.breakers.get(id),

    buses: () => sortById([...maps.buses.values()]),
    substations: () => sortById([...maps.substations.values()]),
    lines: () => sortById([...maps.lines.values()]),
    transformers: () => sortById([...maps.transformers.values()]),
    generators: () => sortById([...maps.generators.values()]),
    loads: () => sortById([...maps.loads.values()]),
    breakers: () => sortById([...maps.breakers.values()]),
    edges: () => sortById([...maps.lines.values(), ...maps.transformers.values()]),

    neighbors: (bus) => cachedAdjacency.get(bus) ?? [],
    generatorsAt: (bus) => sortById([...maps.generators.values()].filter((g) => g.busId === bus)),
    loadsAt: (bus) => sortById([...maps.loads.values()].filter((l) => l.busId === bus)),
    breakersOf: (line) => sortById([...maps.breakers.values()].filter((b) => b.lineId === line)),
    reachable: (from) => reachableFrom(from, cachedAdjacency),
    shortestPath: (from, to) => shortestPath(from, to, cachedAdjacency),
    islands: () => cachedIslands,
    islandOf: (bus) => cachedIslands.find((island) => island.includes(bus)) ?? null,
    islandCount: () => cachedIslands.length,
    sources: () => [...new Set([...maps.generators.values()].map((g) => g.busId))].sort(),

    entities: () => entitiesOf(maps),
    toSnapshot: () => graphToSnapshot(entitiesOf(maps), version),
    validate: () => validateGraph(entitiesOf(maps)),
    diagnostics(): GraphDiagnostics {
      const report = validateGraph(entitiesOf(maps));
      return {
        nodeCount: maps.buses.size,
        edgeCount: maps.lines.size + maps.transformers.size,
        islandCount: cachedIslands.length,
        generatorCount: maps.generators.size,
        loadCount: maps.loads.size,
        substationCount: maps.substations.size,
        breakerCount: maps.breakers.size,
        validationPassed: report.valid,
        hash,
        version,
      };
    },

    mutate(recipe: (tx: GraphTransaction) => void): MutationResult {
      const draft = cloneMaps(maps);
      const events: RecordedTopologyEvent[] = [];
      const tick = now();

      const tx: GraphTransaction = {
        addBus(spec) {
          const bus = createBus(spec, tick);
          draft.buses.set(bus.id, bus);
          events.push({ name: TOPOLOGY_EVENT.NodeAdded, payload: { busId: bus.id, tick } });
          return bus.id;
        },
        removeBus(id) {
          draft.buses.delete(id);
          events.push({ name: TOPOLOGY_EVENT.NodeRemoved, payload: { busId: id, tick } });
        },
        addSubstation(spec) {
          const sub = createSubstation(spec, tick);
          draft.substations.set(sub.id, sub);
          events.push({
            name: TOPOLOGY_EVENT.EntityUpdated,
            payload: { entityId: sub.id, kind: sub.kind, version: sub.version, tick },
          });
          return sub.id;
        },
        removeSubstation(id) {
          draft.substations.delete(id);
        },
        addLine(spec) {
          const line = createTransmissionLine(spec, tick);
          draft.lines.set(line.id, line);
          events.push({
            name: TOPOLOGY_EVENT.EdgeAdded,
            payload: { edgeId: line.id, from: line.from, to: line.to, tick },
          });
          return line.id;
        },
        removeLine(id) {
          draft.lines.delete(id);
          events.push({ name: TOPOLOGY_EVENT.EdgeRemoved, payload: { edgeId: id, tick } });
        },
        replaceLine(id, spec) {
          draft.lines.delete(id);
          events.push({ name: TOPOLOGY_EVENT.EdgeRemoved, payload: { edgeId: id, tick } });
          const line = createTransmissionLine(spec, tick);
          draft.lines.set(line.id, line);
          events.push({
            name: TOPOLOGY_EVENT.EdgeAdded,
            payload: { edgeId: line.id, from: line.from, to: line.to, tick },
          });
          return line.id;
        },
        addTransformer(spec) {
          const transformer = createTransformer(spec, tick);
          draft.transformers.set(transformer.id, transformer);
          events.push({
            name: TOPOLOGY_EVENT.EdgeAdded,
            payload: { edgeId: transformer.id, from: transformer.from, to: transformer.to, tick },
          });
          return transformer.id;
        },
        removeTransformer(id) {
          draft.transformers.delete(id);
          events.push({ name: TOPOLOGY_EVENT.EdgeRemoved, payload: { edgeId: id, tick } });
        },
        addGenerator(spec) {
          const generator = createGenerator(spec, tick);
          draft.generators.set(generator.id, generator);
          events.push({
            name: TOPOLOGY_EVENT.EntityUpdated,
            payload: {
              entityId: generator.id,
              kind: generator.kind,
              version: generator.version,
              tick,
            },
          });
          return generator.id;
        },
        removeGenerator(id) {
          draft.generators.delete(id);
        },
        addLoad(spec) {
          const load = createLoad(spec, tick);
          draft.loads.set(load.id, load);
          events.push({
            name: TOPOLOGY_EVENT.EntityUpdated,
            payload: { entityId: load.id, kind: load.kind, version: load.version, tick },
          });
          return load.id;
        },
        removeLoad(id) {
          draft.loads.delete(id);
        },
        addBreaker(spec) {
          const breaker = createBreaker(spec, tick);
          draft.breakers.set(breaker.id, breaker);
          events.push({
            name: TOPOLOGY_EVENT.EntityUpdated,
            payload: { entityId: breaker.id, kind: breaker.kind, version: breaker.version, tick },
          });
          return breaker.id;
        },
        removeBreaker(id) {
          draft.breakers.delete(id);
        },
        updateMetadata(id, metadata) {
          const updated =
            updateInMap(draft.buses, id, tick, metadata) ??
            updateInMap(draft.substations, id, tick, metadata) ??
            updateInMap(draft.lines, id, tick, metadata) ??
            updateInMap(draft.transformers, id, tick, metadata) ??
            updateInMap(draft.generators, id, tick, metadata) ??
            updateInMap(draft.loads, id, tick, metadata) ??
            updateInMap(draft.breakers, id, tick, metadata);
          if (updated === null) {
            throw new GridGuardError(`updateMetadata: unknown entity "${id}"`);
          }
          events.push({
            name: TOPOLOGY_EVENT.EntityUpdated,
            payload: { entityId: id, kind: updated.kind, version: updated.version, tick },
          });
        },
      };

      recipe(tx);

      const report = validateGraph(entitiesOf(draft));
      if (!report.valid) {
        emit(TOPOLOGY_EVENT.ValidationFailed, { issueCount: report.errorCount, tick });
        throw new GraphValidationError(report);
      }

      const beforeIslands = cachedIslands.length;
      maps = draft;
      version += 1;
      recompute();
      const afterIslands = cachedIslands.length;

      for (const event of events) {
        emit(event.name, event.payload);
      }
      emit(TOPOLOGY_EVENT.ValidationPassed, { checks: report.checks, tick });
      emit(TOPOLOGY_EVENT.TopologyChanged, { version, hash, tick });
      if (afterIslands > beforeIslands) {
        emit(TOPOLOGY_EVENT.IslandDetected, { islandCount: afterIslands, tick });
      } else if (afterIslands < beforeIslands) {
        emit(TOPOLOGY_EVENT.IslandRecovered, { islandCount: afterIslands, tick });
      }

      return { version, hash, events: [...events], report };
    },
  };

  return graph;
}
