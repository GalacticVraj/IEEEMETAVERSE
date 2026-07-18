/**
 * A `Result` is an explicit success/failure value used where throwing would
 * hide control flow (solver convergence, validation, serialization). Callers
 * must narrow on `.ok`, which the compiler enforces.
 */
export type Result<TValue, TError = Error> =
  { readonly ok: true; readonly value: TValue } | { readonly ok: false; readonly error: TError };

export const ok = <TValue>(value: TValue): Result<TValue, never> => ({ ok: true, value });

export const err = <TError>(error: TError): Result<never, TError> => ({ ok: false, error });

export const isOk = <TValue, TError>(
  result: Result<TValue, TError>,
): result is { readonly ok: true; readonly value: TValue } => result.ok;

export const isErr = <TValue, TError>(
  result: Result<TValue, TError>,
): result is { readonly ok: false; readonly error: TError } => !result.ok;

/** Transform the success value, leaving errors untouched. */
export const mapResult = <TValue, TError, TNext>(
  result: Result<TValue, TError>,
  fn: (value: TValue) => TNext,
): Result<TNext, TError> => (result.ok ? ok(fn(result.value)) : result);

/** Extract the value or fall back to `fallback` on error. */
export const unwrapOr = <TValue, TError>(
  result: Result<TValue, TError>,
  fallback: TValue,
): TValue => (result.ok ? result.value : fallback);
