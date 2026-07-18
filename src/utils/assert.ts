/**
 * Runtime invariant guard. Narrows `condition` to truthy for the type checker.
 * Pure: throws a plain `Error` (the pure layers have no logger of their own).
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invariant violated: ${message}`);
  }
}

/**
 * Exhaustiveness helper. Placing `assertNever(value)` in the `default` branch of
 * a switch over a union makes the compiler error if a union member is left
 * unhandled — a cheap, powerful guard for the state machine and event routing.
 */
export function assertNever(value: never, message = 'Unhandled union member'): never {
  throw new Error(`${message}: ${String(value)}`);
}
