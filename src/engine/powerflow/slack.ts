import type { BusId } from '@app-types';

export interface SlackSelection {
  readonly bus: BusId;
  readonly reason: 'configured' | 'generator-priority' | 'fallback';
}

/**
 * Deterministic slack-bus selection for one island. Order of preference:
 * 1. a configured slack, if it belongs to this island;
 * 2. the bus with the largest total generator capacity (generator priority),
 *    ties broken by smallest bus id;
 * 3. otherwise the smallest bus id (fallback).
 *
 * There is always exactly one slack per island. `buses` must be non-empty.
 */
export function selectSlack(
  buses: readonly BusId[],
  generatorCapacityByBus: ReadonlyMap<BusId, number>,
  configuredSlack?: BusId,
): SlackSelection {
  const sorted = [...buses].sort();

  if (configuredSlack !== undefined && sorted.includes(configuredSlack)) {
    return { bus: configuredSlack, reason: 'configured' };
  }

  let best: BusId | null = null;
  let bestCapacity = 0;
  for (const bus of sorted) {
    const capacity = generatorCapacityByBus.get(bus) ?? 0;
    if (capacity > bestCapacity) {
      bestCapacity = capacity;
      best = bus;
    }
  }
  if (best !== null) {
    return { bus: best, reason: 'generator-priority' };
  }

  return { bus: sorted[0] as BusId, reason: 'fallback' };
}
