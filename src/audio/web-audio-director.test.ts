/* eslint-disable @typescript-eslint/unbound-method */
import { GRID_EVENT } from '@constants';
import type { GridEventBus } from '@core';
import { useAdvisorStore, useUiStore } from '@state';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AudioEngine } from './audio-engine';
import { createAudioDirector } from './web-audio-director';

interface TestBus extends GridEventBus {
  emit<K extends keyof Record<string, unknown>>(event: K, payload?: unknown): void;
}

const makeFakeBus = (): TestBus => {
  const listeners: Record<string, ((payload: unknown) => void)[]> = {};
  return {
    on: vi.fn((event: string, fn: (p: unknown) => void) => {
      listeners[event] ??= [];
      listeners[event]?.push(fn);
      return () => {
        listeners[event] = (listeners[event] ?? []).filter((l) => l !== fn);
      };
    }),
    emit: (event: string, payload?: unknown) => {
      (listeners[event] ?? []).forEach((fn) => fn(payload));
    },
  } as unknown as TestBus;
};

describe('WebAudioDirector', () => {
  let fakeEngine: AudioEngine;
  let fakeBus: TestBus;

  beforeEach(() => {
    fakeEngine = {
      init: vi.fn(),
      attach: vi.fn(),
      detach: vi.fn(),
      dispose: vi.fn(),
      playSfx: vi.fn(),
      playMusic: vi.fn(),
      stopMusic: vi.fn(),
      duck: vi.fn(),
      setMasterVolume: vi.fn(),
      setSfxVolume: vi.fn(),
      setMusicVolume: vi.fn(),
      setMuted: vi.fn(),
    } as unknown as AudioEngine;

    fakeBus = makeFakeBus();
    useAdvisorStore.setState({ current: null });
    useUiStore.setState({ soundMuted: false, onboardingActive: false, onboardingStep: 1 });
  });

  it('attaches to bus and initializes engine on start', () => {
    const director = createAudioDirector(fakeBus, fakeEngine);
    director.start();

    expect(fakeEngine.init).toHaveBeenCalled();
    expect(fakeEngine.attach).toHaveBeenCalledWith(fakeBus);
    director.stop();
  });

  it('triggers action.commit SFX on DecisionCommitted event', () => {
    const director = createAudioDirector(fakeBus, fakeEngine);
    director.start();

    fakeBus.emit(GRID_EVENT.DecisionCommitted, { decisionId: 'op-1', optionIndex: 0, simTime: 10 });
    expect(fakeEngine.playSfx).toHaveBeenCalledWith('action.commit');
    director.stop();
  });

  it('triggers breakerTrip SFX on LineTripped event', () => {
    const director = createAudioDirector(fakeBus, fakeEngine);
    director.start();

    fakeBus.emit(GRID_EVENT.LineTripped, { line: 'L-1', cause: 'thermal' });
    expect(fakeEngine.playSfx).toHaveBeenCalledWith('grid.breakerTrip');
    director.stop();
  });

  it('triggers blackout SFX on ZoneBlackout event', () => {
    const director = createAudioDirector(fakeBus, fakeEngine);
    director.start();

    fakeBus.emit(GRID_EVENT.ZoneBlackout, { zone: 'DT', unservedLoad: 50 });
    expect(fakeEngine.playSfx).toHaveBeenCalledWith('grid.blackout');
    director.stop();
  });

  it('ducks music when AI advisor is speaking', () => {
    const director = createAudioDirector(fakeBus, fakeEngine);
    director.start();

    expect(fakeEngine.duck).toHaveBeenLastCalledWith(false);

    useAdvisorStore.setState({ current: { id: 1, kind: 'question', text: 'Grid stress high' } });
    expect(fakeEngine.duck).toHaveBeenLastCalledWith(true);

    useAdvisorStore.setState({ current: null });
    expect(fakeEngine.duck).toHaveBeenLastCalledWith(false);
    director.stop();
  });

  it('ducks music when onboarding tour is active', () => {
    const director = createAudioDirector(fakeBus, fakeEngine);
    director.start();

    expect(fakeEngine.duck).toHaveBeenLastCalledWith(false);

    useUiStore.setState({ onboardingActive: true });
    expect(fakeEngine.duck).toHaveBeenLastCalledWith(true);

    useUiStore.setState({ onboardingActive: false });
    expect(fakeEngine.duck).toHaveBeenLastCalledWith(false);
    director.stop();
  });
});
