import { beforeEach, describe, expect, it } from 'vitest';

import { OPERATOR_HOME, frameNode } from './shots';

import { INPUT_SUPPRESSION_MS, isFollowSuppressed, useCameraStore } from './camera-store';

const reset = (): void => {
  useCameraStore.setState({
    request: null,
    transition: 'idle',
    autoFollow: true,
    introActive: false,
    introDone: false,
    lastUserInputAt: -Infinity,
    savedPose: null,
    currentShotName: null,
  });
};

describe('camera store priority resolution', () => {
  beforeEach(reset);

  it('accepts a request when idle', () => {
    const applied = useCameraStore.getState().requestShot(OPERATOR_HOME, {
      priority: 60,
      timing: 'NORMAL',
    });
    expect(applied).toBe(true);
    expect(useCameraStore.getState().request?.shot.name).toBe('OperatorHome');
  });

  it('higher priority replaces an active request', () => {
    const { requestShot } = useCameraStore.getState();
    requestShot(OPERATOR_HOME, { priority: 60, timing: 'NORMAL' });
    const applied = requestShot(frameNode('Inspect_Generator', [80, 65]), {
      priority: 90,
      timing: 'NORMAL',
    });
    expect(applied).toBe(true);
    expect(useCameraStore.getState().request?.priority).toBe(90);
  });

  it('lower priority is ignored while a higher request is active', () => {
    const { requestShot } = useCameraStore.getState();
    requestShot(frameNode('Inspect_Generator', [80, 65]), { priority: 90, timing: 'NORMAL' });
    const applied = requestShot(OPERATOR_HOME, { priority: 60, timing: 'NORMAL' });
    expect(applied).toBe(false);
    expect(useCameraStore.getState().request?.priority).toBe(90);
  });

  it('equal priority replaces (newest event wins)', () => {
    const { requestShot } = useCameraStore.getState();
    requestShot(frameNode('Critical_ProtectionTrip', [0, 75]), { priority: 80, timing: 'NORMAL' });
    const firstSeq = useCameraStore.getState().request?.seq;
    requestShot(frameNode('Critical_Blackout', [0, 66]), { priority: 80, timing: 'NORMAL' });
    const state = useCameraStore.getState();
    expect(state.request?.shot.name).toBe('Critical_Blackout');
    expect(state.request?.seq).not.toBe(firstSeq);
  });

  it('user input cancels any scripted motion and stamps the input time', () => {
    const { requestShot } = useCameraStore.getState();
    requestShot(frameNode('Inspect_Generator', [80, 65]), { priority: 90, timing: 'NORMAL' });
    useCameraStore.getState().cancelScripted(12_345);
    const state = useCameraStore.getState();
    expect(state.request).toBeNull();
    expect(state.lastUserInputAt).toBe(12_345);
  });
});

describe('follow suppression window', () => {
  it('suppresses follow shots within the window and allows them after', () => {
    expect(isFollowSuppressed(1_000, 1_000 + INPUT_SUPPRESSION_MS - 1)).toBe(true);
    expect(isFollowSuppressed(1_000, 1_000 + INPUT_SUPPRESSION_MS + 1)).toBe(false);
  });
});

describe('saved pose semantics', () => {
  beforeEach(reset);

  it('saves once and clears explicitly', () => {
    const store = useCameraStore.getState();
    store.savePose({ position: [1, 2, 3], target: [0, 0, 0] });
    // second save must not overwrite the original pre-focus pose
    useCameraStore.getState().savePose({ position: [9, 9, 9], target: [0, 0, 0] });
    expect(useCameraStore.getState().savedPose?.position[0]).toBe(1);
    useCameraStore.getState().clearSavedPose();
    expect(useCameraStore.getState().savedPose).toBeNull();
  });
});
