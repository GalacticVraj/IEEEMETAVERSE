import { createToken } from '@core';
import type { Result, Serializer, Token } from '@core';

import type { ReplayRecording } from '../model';

/**
 * Persists recordings to/from portable text so a run can be shared or reloaded.
 * Delegates raw encoding to an injected {@link Serializer} (e.g. the pure JSON
 * backend), keeping the encoding pluggable.
 */
export interface ReplaySerializer {
  serialize(recording: ReplayRecording): Result<string, Error>;
  deserialize(text: string): Result<ReplayRecording, Error>;
}

export const REPLAY_SERIALIZER: Token<ReplaySerializer> = createToken('ReplaySerializer');

export function createReplaySerializer(backend: Serializer): ReplaySerializer {
  return {
    serialize: (recording) => backend.serialize(recording),
    deserialize: (text) => backend.deserialize<ReplayRecording>(text),
  };
}
