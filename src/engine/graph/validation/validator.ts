import type { BusId } from '@app-types';

import type { GraphEntities } from '../graph-model';

export type GraphValidationSeverity = 'error' | 'warning';

export interface GraphValidationIssue {
  readonly code: string;
  readonly severity: GraphValidationSeverity;
  readonly message: string;
  readonly entityId?: string;
}

/** Structured diagnostic report. `valid` is true iff there are zero errors. */
export interface GraphValidationReport {
  readonly valid: boolean;
  readonly issues: readonly GraphValidationIssue[];
  readonly errorCount: number;
  readonly warningCount: number;
  /** Number of distinct validation rules applied. */
  readonly checks: number;
}

const RULE_COUNT = 11;

/**
 * The `ElectricalGraphValidator`. Runs structural integrity checks over a graph
 * entity bag and produces a structured report. It NEVER repairs topology — it
 * only reports. A transaction that fails validation is rejected wholesale
 * (fail fast); nothing is silently fixed.
 */
export function validateGraph(entities: GraphEntities): GraphValidationReport {
  const issues: GraphValidationIssue[] = [];
  const push = (
    severity: GraphValidationSeverity,
    code: string,
    message: string,
    entityId?: string,
  ): void => {
    issues.push(
      entityId === undefined ? { code, severity, message } : { code, severity, message, entityId },
    );
  };
  const error = (code: string, message: string, entityId?: string): void => {
    push('error', code, message, entityId);
  };
  const warn = (code: string, message: string, entityId?: string): void => {
    push('warning', code, message, entityId);
  };

  const busIds = new Set<string>(entities.buses.map((bus) => bus.id));
  const lineIds = new Set<string>(entities.lines.map((line) => line.id));
  const substationIds = new Set<string>(entities.substations.map((sub) => sub.id));

  // 1 · Duplicate ids across the whole graph.
  const allIds: string[] = [
    ...entities.buses.map((entity) => entity.id),
    ...entities.substations.map((entity) => entity.id),
    ...entities.lines.map((entity) => entity.id),
    ...entities.transformers.map((entity) => entity.id),
    ...entities.generators.map((entity) => entity.id),
    ...entities.loads.map((entity) => entity.id),
    ...entities.breakers.map((entity) => entity.id),
  ];
  const seen = new Set<string>();
  for (const id of allIds) {
    if (seen.has(id)) {
      error('DUPLICATE_ID', `Duplicate entity id: ${id}`, id);
    } else {
      seen.add(id);
    }
  }

  // Edges = lines + transformers. Track incidence for disconnected-bus checks.
  const edges = [...entities.lines, ...entities.transformers];
  const incident = new Map<BusId, number>();
  for (const bus of entities.buses) {
    incident.set(bus.id, 0);
  }

  // 2 · Self-loops · 3 · Missing edge endpoints.
  for (const edge of edges) {
    if (edge.from === edge.to) {
      error('SELF_LOOP', `Edge ${edge.id} connects a bus to itself`, edge.id);
    }
    if (busIds.has(edge.from)) {
      incident.set(edge.from, (incident.get(edge.from) ?? 0) + 1);
    } else {
      error('MISSING_REFERENCE', `Edge ${edge.id} references missing bus ${edge.from}`, edge.id);
    }
    if (busIds.has(edge.to)) {
      incident.set(edge.to, (incident.get(edge.to) ?? 0) + 1);
    } else {
      error('MISSING_REFERENCE', `Edge ${edge.id} references missing bus ${edge.to}`, edge.id);
    }
  }

  // 4 · Line electrical placeholders (negative/zero values).
  for (const line of entities.lines) {
    if (line.capacityMw < 0) {
      error('NEGATIVE_CAPACITY', `Line ${line.id} has negative capacity`, line.id);
    }
    if (line.reactancePu < 0) {
      error('NEGATIVE_REACTANCE', `Line ${line.id} has negative reactance`, line.id);
    } else if (line.reactancePu === 0) {
      warn('ZERO_REACTANCE', `Line ${line.id} has zero reactance (placeholder)`, line.id);
    }
  }

  // 5 · Generators · 6 · Loads (missing bus, negative magnitudes).
  for (const generator of entities.generators) {
    if (!busIds.has(generator.busId)) {
      error(
        'MISSING_REFERENCE',
        `Generator ${generator.id} references missing bus ${generator.busId}`,
        generator.id,
      );
    }
    if (generator.capacityMw < 0) {
      error('NEGATIVE_CAPACITY', `Generator ${generator.id} has negative capacity`, generator.id);
    }
  }
  for (const load of entities.loads) {
    if (!busIds.has(load.busId)) {
      error('MISSING_REFERENCE', `Load ${load.id} references missing bus ${load.busId}`, load.id);
    }
    if (load.nominalDemandMw < 0) {
      error('NEGATIVE_CAPACITY', `Load ${load.id} has negative demand`, load.id);
    }
  }

  // 7 · Breaker references.
  for (const breaker of entities.breakers) {
    if (breaker.lineId === null && breaker.busId === null) {
      error(
        'INVALID_BREAKER',
        `Breaker ${breaker.id} references neither a line nor a bus`,
        breaker.id,
      );
    }
    if (breaker.lineId !== null && !lineIds.has(breaker.lineId)) {
      error(
        'MISSING_REFERENCE',
        `Breaker ${breaker.id} references missing line ${breaker.lineId}`,
        breaker.id,
      );
    }
    if (breaker.busId !== null && !busIds.has(breaker.busId)) {
      error(
        'MISSING_REFERENCE',
        `Breaker ${breaker.id} references missing bus ${breaker.busId}`,
        breaker.id,
      );
    }
  }

  // 8 · Substations · 9 · Bus↔substation ownership.
  for (const substation of entities.substations) {
    if (substation.busIds.length === 0) {
      warn('EMPTY_SUBSTATION', `Substation ${substation.id} owns no buses`, substation.id);
    }
    for (const busId of substation.busIds) {
      if (!busIds.has(busId)) {
        error(
          'MISSING_REFERENCE',
          `Substation ${substation.id} references missing bus ${busId}`,
          substation.id,
        );
      }
    }
  }
  for (const bus of entities.buses) {
    if (bus.substationId !== null && !substationIds.has(bus.substationId)) {
      error(
        'MISSING_REFERENCE',
        `Bus ${bus.id} references missing substation ${bus.substationId}`,
        bus.id,
      );
    }
    // 10 · Disconnected buses (warning — an isolated bus is legal but suspect).
    if ((incident.get(bus.id) ?? 0) === 0) {
      warn('DISCONNECTED_BUS', `Bus ${bus.id} has no incident edges`, bus.id);
    }
  }

  // 11 · Parallel edges between the same bus pair (warning — valid but notable).
  const pairCounts = new Map<string, number>();
  for (const edge of edges) {
    const key = [String(edge.from), String(edge.to)].sort().join('::');
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }
  for (const [key, count] of pairCounts) {
    if (count > 1) {
      warn('PARALLEL_EDGES', `${count} parallel edges between ${key}`);
    }
  }

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  return {
    valid: errorCount === 0,
    issues,
    errorCount,
    warningCount: issues.length - errorCount,
    checks: RULE_COUNT,
  };
}
