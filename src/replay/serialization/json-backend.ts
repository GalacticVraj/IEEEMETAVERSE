import { err, ok } from '@core';
import type { Result, Serializer } from '@core';

const toError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

/**
 * A pure JSON {@link Serializer} for recordings. Lives here (not in `@infra`) so
 * the pure `@replay` layer can serialize without importing a consumer layer.
 * `JSON` is a core ECMAScript global — no DOM or Node APIs are used.
 */
export function createJsonReplayBackend(): Serializer {
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
