import { describe, expect, it } from 'vitest';

import { ContainerResolutionError } from '@core/errors/errors';

import { createContainer, createToken } from './container';

describe('DI container', () => {
  it('resolves a registered factory as a cached singleton', () => {
    const token = createToken<{ id: number }>('thing');
    const container = createContainer();
    let count = 0;
    container.register(token, () => {
      count += 1;
      return { id: count };
    });
    const a = container.resolve(token);
    const b = container.resolve(token);
    expect(a).toBe(b);
    expect(count).toBe(1);
  });

  it('registerValue returns the exact value', () => {
    const token = createToken<number>('n');
    const container = createContainer();
    container.registerValue(token, 5);
    expect(container.resolve(token)).toBe(5);
  });

  it('throws ContainerResolutionError for an unregistered token', () => {
    const container = createContainer();
    const token = createToken<number>('missing');
    expect(() => container.resolve(token)).toThrow(ContainerResolutionError);
  });

  it('has() reports registration state', () => {
    const container = createContainer();
    const token = createToken<number>('n');
    expect(container.has(token)).toBe(false);
    container.registerValue(token, 1);
    expect(container.has(token)).toBe(true);
  });

  it('factories can resolve their own dependencies from the container', () => {
    const dep = createToken<number>('dep');
    const svc = createToken<number>('svc');
    const container = createContainer();
    container.registerValue(dep, 10);
    container.register(svc, (c) => c.resolve(dep) + 1);
    expect(container.resolve(svc)).toBe(11);
  });

  it('a scope resolves its own singleton instances', () => {
    const token = createToken<object>('obj');
    const parent = createContainer();
    parent.register(token, () => ({}));
    const scope = parent.createScope();
    expect(scope.resolve(token)).not.toBe(parent.resolve(token));
  });
});
