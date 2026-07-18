# 03 · Topology API

The public surface is the `ElectricalGraph` interface, constructed via
`createElectricalGraph(options)`. It splits cleanly into **reads** (lookups,
collections, queries, projections) and a **single write path** (`mutate`).

## Construction

```ts
const graph = createElectricalGraph({ events, now });
```

`ElectricalGraphOptions`:

| Option   | Type                                              | Default   | Purpose                                   |
| -------- | ------------------------------------------------- | --------- | ----------------------------------------- |
| `events` | `TypedEventBus<TEvents extends TopologyEventMap>` | none      | Optional bus to emit topology events on   |
| `now`    | `() => number`                                    | `() => 0` | Current tick source for entity provenance |

On creation the graph runs `recompute()` (hash + adjacency + islands over an
empty graph) and emits `GraphCreated { version, hash }`. In the composition root
it is registered under the `ELECTRICAL_GRAPH` token with
`now: () => kernel.clock.tick`.

## State accessors

| Member    | Type              | Notes                                                    |
| --------- | ----------------- | -------------------------------------------------------- |
| `version` | `number` (getter) | Increments once per committed transaction; starts at `0` |
| `hash`    | `string` (getter) | Current structural topology hash                         |

## Lookups — `O(1)` map reads

Return the entity or `undefined`.

| Method                              | Returns                         |
| ----------------------------------- | ------------------------------- |
| `getBus(id: BusId)`                 | `Bus \| undefined`              |
| `getSubstation(id: SubstationId)`   | `Substation \| undefined`       |
| `getLine(id: LineId)`               | `TransmissionLine \| undefined` |
| `getTransformer(id: TransformerId)` | `Transformer \| undefined`      |
| `getGenerator(id: GeneratorId)`     | `Generator \| undefined`        |
| `getLoad(id: LoadId)`               | `Load \| undefined`             |
| `getBreaker(id: BreakerId)`         | `Breaker \| undefined`          |

## Collections — id-sorted snapshots

Each returns a fresh, **id-sorted**, read-only array (deterministic ordering).

| Method           | Returns                                                  |
| ---------------- | -------------------------------------------------------- |
| `buses()`        | `readonly Bus[]`                                         |
| `substations()`  | `readonly Substation[]`                                  |
| `lines()`        | `readonly TransmissionLine[]`                            |
| `transformers()` | `readonly Transformer[]`                                 |
| `generators()`   | `readonly Generator[]`                                   |
| `loads()`        | `readonly Load[]`                                        |
| `breakers()`     | `readonly Breaker[]`                                     |
| `edges()`        | `readonly GraphEdge[]` (lines + transformers, id-sorted) |

## Queries — topology answers

See [06-query-engine.md](./06-query-engine.md) for algorithm detail and
determinism notes.

| Method                     | Returns                         | Meaning                                                 |
| -------------------------- | ------------------------------- | ------------------------------------------------------- |
| `neighbors(bus: BusId)`    | `readonly BusId[]`              | Adjacent buses (from cached adjacency; `[]` if unknown) |
| `generatorsAt(bus: BusId)` | `readonly Generator[]`          | Generators attached to a bus (id-sorted)                |
| `loadsAt(bus: BusId)`      | `readonly Load[]`               | Loads attached to a bus (id-sorted)                     |
| `breakersOf(line: LineId)` | `readonly Breaker[]`            | Breakers whose `lineId` matches (id-sorted)             |
| `reachable(from: BusId)`   | `ReadonlySet<BusId>`            | All buses reachable via BFS                             |
| `shortestPath(from, to)`   | `readonly BusId[] \| null`      | Shortest bus path (BFS), or `null` if unreachable       |
| `islands()`                | `readonly (readonly BusId[])[]` | Connected components (electrical islands), cached       |
| `islandOf(bus: BusId)`     | `readonly BusId[] \| null`      | The island containing `bus`, or `null`                  |
| `islandCount()`            | `number`                        | Number of islands                                       |
| `sources()`                | `readonly BusId[]`              | Buses hosting a generator (sorted, de-duplicated)       |

## Projections & diagnostics

| Method          | Returns                 | Notes                                                                           |
| --------------- | ----------------------- | ------------------------------------------------------------------------------- |
| `entities()`    | `GraphEntities`         | Flat entity bag (insertion order of the maps)                                   |
| `toSnapshot()`  | `GraphSnapshot`         | id-sorted entities + `version` (see [07](./07-serialization-and-versioning.md)) |
| `validate()`    | `GraphValidationReport` | Runs the 11-check validator on current state                                    |
| `diagnostics()` | `GraphDiagnostics`      | Console-facing counters + `validationPassed` + `hash` + `version`               |

`GraphDiagnostics` fields: `nodeCount`, `edgeCount`, `islandCount`,
`generatorCount`, `loadCount`, `substationCount`, `breakerCount`,
`validationPassed`, `hash`, `version`. Format for logging with
`formatGraphDiagnostics(graph.diagnostics())` (from `diagnostics.ts`).

## The write path — `mutate`

```ts
const result: MutationResult = graph.mutate((tx) => {
  const a = tx.addBus({ id: asBusId('A'), nominalVoltageKv: 138 });
  const b = tx.addBus({ id: asBusId('B'), nominalVoltageKv: 138 });
  tx.addLine({ id: asLineId('A-B'), from: a, to: b, capacityMw: 200, reactancePu: 0.1 });
});
```

`mutate(recipe)` runs the recipe against a **draft**, validates, and either
commits (returning a `MutationResult`) or throws `GraphValidationError`. The full
pipeline, determinism guarantees, and emitted events are documented in
[04-mutation-rules.md](./04-mutation-rules.md).

`MutationResult`:

| Field     | Type                               | Meaning                                  |
| --------- | ---------------------------------- | ---------------------------------------- |
| `version` | `number`                           | New graph version after commit           |
| `hash`    | `string`                           | New structural hash                      |
| `events`  | `readonly RecordedTopologyEvent[]` | Per-op events recorded during the recipe |
| `report`  | `GraphValidationReport`            | The passing validation report            |

### `GraphTransaction` — staged operations

No entity mutates itself; every change is staged on the draft through the
transaction. Add operations return the new entity's branded id.

| Method                         | Returns         | Effect (recorded event)                                 |
| ------------------------------ | --------------- | ------------------------------------------------------- |
| `addBus(spec)`                 | `BusId`         | `NodeAdded`                                             |
| `removeBus(id)`                | `void`          | `NodeRemoved`                                           |
| `addSubstation(spec)`          | `SubstationId`  | `EntityUpdated`                                         |
| `removeSubstation(id)`         | `void`          | _(no per-op event)_                                     |
| `addLine(spec)`                | `LineId`        | `EdgeAdded`                                             |
| `removeLine(id)`               | `void`          | `EdgeRemoved`                                           |
| `replaceLine(id, spec)`        | `LineId`        | `EdgeRemoved` then `EdgeAdded`                          |
| `addTransformer(spec)`         | `TransformerId` | `EdgeAdded`                                             |
| `removeTransformer(id)`        | `void`          | `EdgeRemoved`                                           |
| `addGenerator(spec)`           | `GeneratorId`   | `EntityUpdated`                                         |
| `removeGenerator(id)`          | `void`          | _(no per-op event)_                                     |
| `addLoad(spec)`                | `LoadId`        | `EntityUpdated`                                         |
| `removeLoad(id)`               | `void`          | _(no per-op event)_                                     |
| `addBreaker(spec)`             | `BreakerId`     | `EntityUpdated`                                         |
| `removeBreaker(id)`            | `void`          | _(no per-op event)_                                     |
| `updateMetadata(id, metadata)` | `void`          | `EntityUpdated` (throws `GridGuardError` if id unknown) |

`updateMetadata` searches every entity map for `id`; the first match is replaced
via `touchMeta` (version bumped, `lastModifiedTick` advanced). If no map contains
`id`, it throws `GridGuardError("updateMetadata: unknown entity …")` — this is a
recipe-time throw, distinct from validation failure.
