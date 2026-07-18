/**
 * Error hierarchy for GridGuard. A single base class means all domain errors
 * are catchable as `GridGuardError` and report their concrete subclass name.
 */
export class GridGuardError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    // Report the concrete subclass name (e.g. "NotImplementedError").
    this.name = new.target.name;
  }
}

/**
 * Thrown by every Phase-1 placeholder. Carries the symbol being called and a
 * human description of the behavior a later phase will implement, so a stack
 * trace during development says exactly what is missing and what it will do.
 */
export class NotImplementedError extends GridGuardError {
  public constructor(
    public readonly symbol: string,
    public readonly plannedBehavior: string,
  ) {
    super(`Not implemented yet: ${symbol}. Planned: ${plannedBehavior}`);
  }
}

/** Thrown when the simulation FSM is asked to make an illegal transition. */
export class InvalidStateTransitionError extends GridGuardError {
  public constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Illegal simulation state transition: ${from} -> ${to}`);
  }
}

/** Thrown when the DI container cannot resolve a requested token. */
export class ContainerResolutionError extends GridGuardError {
  public constructor(public readonly tokenName: string) {
    super(`No provider registered for token: ${tokenName}`);
  }
}

/**
 * Canonical placeholder body. Referencing the caller's arguments via `context`
 * keeps them "used" under `noUnusedParameters`, and documents intent at the call
 * site. Returns `never`, so it satisfies any declared return type.
 *
 * @example
 * solve(topology: GridTopology): PowerFlowResult {
 *   return notImplemented('PowerFlowSolver.solve', 'Newton-Raphson AC solve', { topology });
 * }
 */
export function notImplemented(
  symbol: string,
  plannedBehavior: string,
  _context?: Readonly<Record<string, unknown>>,
): never {
  throw new NotImplementedError(symbol, plannedBehavior);
}
