import { asSystemId } from '@app-types';
import type { SystemId } from '@app-types';
import { CircularDependencyError, MissingDependencyError } from '@core';
import type { SimulationSystem } from '@core';
import { describe, expect, it } from 'vitest';

import { createSystemRegistry } from './system-registry';

const makeSystem = (id: string, dependencies: string[] = []): SimulationSystem => ({
  id: asSystemId(id),
  dependencies: dependencies.map(asSystemId),
  init: () => undefined,
  step: () => undefined,
  reset: () => undefined,
  dispose: () => undefined,
});

const ids = (systems: readonly SimulationSystem[]): SystemId[] => systems.map((s) => s.id);

describe('SystemRegistry', () => {
  it('keeps registration order in all()', () => {
    const registry = createSystemRegistry();
    registry.register(makeSystem('a'));
    registry.register(makeSystem('b'));
    expect(ids(registry.all())).toEqual([asSystemId('a'), asSystemId('b')]);
  });

  it('rejects duplicate ids', () => {
    const registry = createSystemRegistry();
    registry.register(makeSystem('a'));
    expect(() => {
      registry.register(makeSystem('a'));
    }).toThrow();
  });

  it('orders systems so dependencies run first', () => {
    const registry = createSystemRegistry();
    // Register out of dependency order on purpose.
    registry.register(makeSystem('powerflow', ['load', 'generation']));
    registry.register(makeSystem('load', ['weather']));
    registry.register(makeSystem('generation', ['weather']));
    registry.register(makeSystem('weather'));

    const order = ids(registry.resolveOrder()).map(String);
    expect(order.indexOf('weather')).toBeLessThan(order.indexOf('load'));
    expect(order.indexOf('weather')).toBeLessThan(order.indexOf('generation'));
    expect(order.indexOf('load')).toBeLessThan(order.indexOf('powerflow'));
    expect(order.indexOf('generation')).toBeLessThan(order.indexOf('powerflow'));
  });

  it('is deterministic: equal runs produce identical order', () => {
    const build = (): string[] => {
      const registry = createSystemRegistry();
      registry.register(makeSystem('a'));
      registry.register(makeSystem('b', ['a']));
      registry.register(makeSystem('c', ['a']));
      registry.register(makeSystem('d', ['b', 'c']));
      return ids(registry.resolveOrder()).map(String);
    };
    expect(build()).toEqual(build());
  });

  it('breaks ties by registration order', () => {
    const registry = createSystemRegistry();
    registry.register(makeSystem('first'));
    registry.register(makeSystem('second'));
    // No dependencies — order should follow registration.
    expect(ids(registry.resolveOrder()).map(String)).toEqual(['first', 'second']);
  });

  it('throws CircularDependencyError on a cycle', () => {
    const registry = createSystemRegistry();
    registry.register(makeSystem('a', ['b']));
    registry.register(makeSystem('b', ['a']));
    expect(() => registry.resolveOrder()).toThrow(CircularDependencyError);
  });

  it('throws MissingDependencyError for an unregistered dependency', () => {
    const registry = createSystemRegistry();
    registry.register(makeSystem('a', ['ghost']));
    expect(() => registry.resolveOrder()).toThrow(MissingDependencyError);
  });
});
