import { createToken, notImplemented } from '@core';
import type { Result, Serializer, Token } from '@core';

import type { ReplayRecording } from '../model';

/**
 * Persists recordings to/from portable text so a run can be shared or reloaded.
 * Delegates raw encoding to a `Serializer`; adds recording-specific versioning
 * and validation on top.
 */
export interface IReplaySerializer {
  serialize(recording: ReplayRecording): Result<string, Error>;
  deserialize(text: string): Result<ReplayRecording, Error>;
}

export const REPLAY_SERIALIZER: Token<IReplaySerializer> = createToken('ReplaySerializer');

/**
 * Placeholder replay serializer.
 *
 * PHASE 8 will wrap the injected {@link Serializer} with a schema version and
 * integrity checks so recordings remain loadable across builds.
 */
export class PlaceholderReplaySerializer implements IReplaySerializer {
  public constructor(private readonly serializer: Serializer) {}

  public serialize(recording: ReplayRecording): Result<string, Error> {
    return notImplemented('ReplaySerializer.serialize', 'Version + encode a recording.', {
      recording,
      serializer: this.serializer,
    });
  }

  public deserialize(text: string): Result<ReplayRecording, Error> {
    return notImplemented('ReplaySerializer.deserialize', 'Decode + validate a recording.', {
      text,
    });
  }
}
