import { ContainerResolutionError } from '@core/errors/errors';

/**
 * A dependency-injection token. The phantom `__type` carries the provided
 * type `T` so `resolve(token)` returns `T` with no casts at the call site.
 * The token's identity is its `symbol`, not its name.
 */
export interface Token<T> {
  readonly key: symbol;
  readonly name: string;
  /** Phantom — never read at runtime; exists only to carry `T`. */
  readonly __type?: T;
}

/** Create a uniquely-identified, typed DI token. */
export const createToken = <T>(name: string): Token<T> => ({ key: Symbol(name), name });

export type Factory<T> = (container: Container) => T;

/**
 * Minimal, deterministic, hand-rolled DI container.
 *
 * - Providers are singletons within a container: a factory runs at most once,
 *   its result is cached.
 * - `createScope()` snapshots the current factories into a child that resolves
 *   its own fresh singletons (used for per-run isolation and tests).
 *
 * Intentionally tiny: no decorators, no reflection, fully tree-shakeable, and
 * trivial to reason about under deterministic tests.
 */
export interface Container {
  register<T>(token: Token<T>, factory: Factory<T>): void;
  registerValue<T>(token: Token<T>, value: T): void;
  resolve<T>(token: Token<T>): T;
  has(token: Token<unknown>): boolean;
  createScope(): Container;
}

const build = (parentFactories?: ReadonlyMap<symbol, Factory<unknown>>): Container => {
  const factories = new Map<symbol, Factory<unknown>>(parentFactories);
  const instances = new Map<symbol, unknown>();

  function register<T>(token: Token<T>, factory: Factory<T>): void {
    factories.set(token.key, factory);
    instances.delete(token.key);
  }

  function registerValue<T>(token: Token<T>, value: T): void {
    factories.set(token.key, () => value);
    instances.set(token.key, value);
  }

  function resolve<T>(token: Token<T>): T {
    if (instances.has(token.key)) {
      return instances.get(token.key) as T;
    }
    const factory = factories.get(token.key);
    if (factory === undefined) {
      throw new ContainerResolutionError(token.name);
    }
    const instance = factory(container) as T;
    instances.set(token.key, instance);
    return instance;
  }

  function has(token: Token<unknown>): boolean {
    return factories.has(token.key) || instances.has(token.key);
  }

  function createScope(): Container {
    return build(factories);
  }

  const container: Container = { register, registerValue, resolve, has, createScope };
  return container;
};

/** Create a fresh, empty DI container (the application composition root). */
export const createContainer = (): Container => build();
