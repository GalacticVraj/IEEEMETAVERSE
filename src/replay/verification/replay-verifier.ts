import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

import type { ReplayRecording } from '../model';

export interface VerificationReport {
  /** True if re-simulating the seed reproduced the recorded event stream. */
  readonly deterministic: boolean;
  /** First tick at which live and recorded streams diverged, or null. */
  readonly divergedAtTick: number | null;
  readonly checkedEvents: number;
}

/**
 * Proves a recording is faithful: re-runs the simulation from the recorded seed
 * and asserts the freshly-emitted event stream matches the recording byte-for-
 * byte. This is the guarantee that "replay shows exactly what happened" — and a
 * powerful regression test for the engine's determinism.
 */
export interface IReplayVerifier {
  verify(recording: ReplayRecording): VerificationReport;
}

export const REPLAY_VERIFIER: Token<IReplayVerifier> = createToken('ReplayVerifier');

/**
 * Placeholder replay verifier.
 *
 * PHASE 8 will re-simulate from the seed and diff the event streams, reporting
 * the first divergence (which should never occur if determinism holds).
 */
export class PlaceholderReplayVerifier implements IReplayVerifier {
  public verify(recording: ReplayRecording): VerificationReport {
    return notImplemented(
      'ReplayVerifier.verify',
      'Re-simulate from seed and diff against the recorded event stream.',
      { recording },
    );
  }
}
