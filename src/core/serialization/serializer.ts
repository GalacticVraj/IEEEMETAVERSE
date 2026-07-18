import type { Result } from '@core/result/result';

/**
 * Serialization contract used by replay recording, snapshotting, and config.
 * The pure layers depend on this interface only; the concrete JSON
 * implementation lives in `@infra/serialization`.
 */
export interface Serializer {
  /** Encode a value to a portable string. */
  serialize<T>(value: T): Result<string, Error>;
  /** Decode a value previously produced by {@link serialize}. */
  deserialize<T>(text: string): Result<T, Error>;
}
