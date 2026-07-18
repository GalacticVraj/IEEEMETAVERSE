import { createToken } from '@core';
import type { Token } from '@core';
import { canonicalize } from '@kernel';

import type { RecordedEvent, ReplayRecording } from '../model';

export interface VerificationReport {
  /** True if the two runs produced identical event streams and checkpoints. */
  readonly deterministic: boolean;
  /** First tick at which the runs diverged, or null. */
  readonly divergedAtTick: number | null;
  /** Number of events compared before a divergence (or in total). */
  readonly checkedEvents: number;
  readonly expected: RecordedEvent | null;
  readonly actual: RecordedEvent | null;
  /** Tick of the first mismatched checkpoint hash, if any. */
  readonly checkpointMismatchTick: number | null;
}

/**
 * Proves a recording is faithful: given the recorded run and a fresh
 * re-simulation from the same seed, it diffs the event streams and checkpoint
 * hashes and reports the first divergence — which should never occur if
 * determinism holds. This is the strongest guarantee in the runtime.
 */
export interface ReplayVerifier {
  verify(recorded: ReplayRecording, replay: ReplayRecording): VerificationReport;
}

export const REPLAY_VERIFIER: Token<ReplayVerifier> = createToken('ReplayVerifier');

const sameEvent = (a: RecordedEvent, b: RecordedEvent): boolean =>
  a.name === b.name && a.tick === b.tick && canonicalize(a.payload) === canonicalize(b.payload);

export function createReplayVerifier(): ReplayVerifier {
  return {
    verify(recorded: ReplayRecording, replay: ReplayRecording): VerificationReport {
      const shared = Math.min(recorded.events.length, replay.events.length);

      for (let i = 0; i < shared; i += 1) {
        const expected = recorded.events[i];
        const actual = replay.events[i];
        if (expected !== undefined && actual !== undefined && !sameEvent(expected, actual)) {
          return {
            deterministic: false,
            divergedAtTick: expected.tick,
            checkedEvents: i,
            expected,
            actual,
            checkpointMismatchTick: null,
          };
        }
      }

      if (recorded.events.length !== replay.events.length) {
        const expected = recorded.events[shared] ?? null;
        const actual = replay.events[shared] ?? null;
        return {
          deterministic: false,
          divergedAtTick: (expected ?? actual)?.tick ?? null,
          checkedEvents: shared,
          expected,
          actual,
          checkpointMismatchTick: null,
        };
      }

      const sharedCheckpoints = Math.min(recorded.checkpoints.length, replay.checkpoints.length);
      for (let i = 0; i < sharedCheckpoints; i += 1) {
        const expected = recorded.checkpoints[i];
        const actual = replay.checkpoints[i];
        if (expected !== undefined && actual !== undefined && expected.hash !== actual.hash) {
          return {
            deterministic: false,
            divergedAtTick: expected.tick,
            checkedEvents: shared,
            expected: null,
            actual: null,
            checkpointMismatchTick: expected.tick,
          };
        }
      }

      return {
        deterministic: true,
        divergedAtTick: null,
        checkedEvents: shared,
        expected: null,
        actual: null,
        checkpointMismatchTick: null,
      };
    },
  };
}
