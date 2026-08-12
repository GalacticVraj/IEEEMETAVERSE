// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { readDebugFlagFromLocation, useUiStore } from './ui-store';

describe('ui-store debug overlay', () => {
  beforeEach(() => {
    useUiStore.setState({ debugOverlayVisible: false });
  });

  it('is hidden by default', () => {
    expect(useUiStore.getState().debugOverlayVisible).toBe(false);
  });

  it('toggles on and back off', () => {
    useUiStore.getState().toggleDebugOverlay();
    expect(useUiStore.getState().debugOverlayVisible).toBe(true);
    useUiStore.getState().toggleDebugOverlay();
    expect(useUiStore.getState().debugOverlayVisible).toBe(false);
  });

  it('sets an explicit value', () => {
    useUiStore.getState().setDebugOverlay(true);
    expect(useUiStore.getState().debugOverlayVisible).toBe(true);
  });

  it('reads the ?debug flag from a query string', () => {
    expect(readDebugFlagFromLocation('?debug')).toBe(true);
    expect(readDebugFlagFromLocation('?demo')).toBe(false);
    expect(readDebugFlagFromLocation('')).toBe(false);
  });
});

describe('ui-store onboarding transport', () => {
  beforeEach(() => {
    useUiStore.getState().endOnboarding();
  });

  it('starts at the first step', () => {
    useUiStore.getState().startOnboarding();
    expect(useUiStore.getState().onboardingActive).toBe(true);
    expect(useUiStore.getState().onboardingStep).toBe(1);
  });

  it('advances one step at a time without knowing how many steps exist', () => {
    // The store deliberately does NOT hardcode a step count — the tour owns its
    // own length, and duplicating it here let the two drift out of sync.
    useUiStore.getState().startOnboarding();
    for (let expected = 2; expected <= 12; expected++) {
      useUiStore.getState().nextOnboardingStep();
      expect(useUiStore.getState().onboardingStep).toBe(expected);
      expect(useUiStore.getState().onboardingActive).toBe(true);
    }
  });

  it('never steps below the first step', () => {
    useUiStore.getState().startOnboarding();
    useUiStore.getState().prevOnboardingStep();
    useUiStore.getState().prevOnboardingStep();
    expect(useUiStore.getState().onboardingStep).toBe(1);
  });

  it('ends the tour and rewinds to the first step', () => {
    useUiStore.getState().startOnboarding();
    useUiStore.getState().nextOnboardingStep();
    useUiStore.getState().endOnboarding();
    expect(useUiStore.getState().onboardingActive).toBe(false);
    expect(useUiStore.getState().onboardingStep).toBe(1);
  });
});
