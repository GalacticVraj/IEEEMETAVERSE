import { err, ok } from '@core';
import type { Result, Serializer } from '@core';

const toError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

/**
 * Concrete {@link Serializer} using JSON. Returns `Result` rather than throwing,
 * so callers (replay, snapshots, config) handle malformed data explicitly.
 */
export function createJsonSerializer(): Serializer {
  return {
    serialize<T>(value: T): Result<string, Error> {
      try {
        return ok(JSON.stringify(value));
      } catch (cause) {
        return err(toError(cause));
      }
    },
    deserialize<T>(text: string): Result<T, Error> {
      try {
        return ok(JSON.parse(text) as T);
      } catch (cause) {
        return err(toError(cause));
      }
    },
  };
}
