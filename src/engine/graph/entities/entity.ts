/**
 * Common metadata every electrical entity owns. Entities are IMMUTABLE records;
 * a "change" produces a new record with a bumped version and updated
 * `lastModifiedTick`. The graph engine performs no electrical math — these
 * fields describe identity and provenance, not physics.
 */
export interface EntityMeta {
  readonly version: number;
  readonly creationTick: number;
  readonly lastModifiedTick: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** The kinds of entity the graph tracks. */
export const EntityKind = {
  Bus: 'bus',
  Substation: 'substation',
  Line: 'line',
  Transformer: 'transformer',
  Generator: 'generator',
  Load: 'load',
  Breaker: 'breaker',
} as const;
export type EntityKind = (typeof EntityKind)[keyof typeof EntityKind];

/** Metadata for a freshly-created entity (version 1). */
export const initialMeta = (
  tick: number,
  metadata: Readonly<Record<string, unknown>> = {},
): EntityMeta => ({
  version: 1,
  creationTick: tick,
  lastModifiedTick: tick,
  metadata,
});

/** Metadata after a modification: version bumped, `lastModifiedTick` advanced. */
export const touchMeta = (
  meta: EntityMeta,
  tick: number,
  metadata?: Readonly<Record<string, unknown>>,
): EntityMeta => ({
  version: meta.version + 1,
  creationTick: meta.creationTick,
  lastModifiedTick: tick,
  metadata: metadata ?? meta.metadata,
});
