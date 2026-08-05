import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ALL_PANELS, TUTORIAL_STORAGE_KEY, createTutorialStore } from './tutorial-store';

type TutorialStore = ReturnType<typeof createTutorialStore>;

/** Minimal in-memory stand-in for the Storage API. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

/** A Storage whose every access throws — Safari private mode, blocked cookies. */
function hostileStorage(): Storage {
  const boom = (): never => {
    throw new Error('storage disabled');
  };
  return {
    get length(): number {
      return boom();
    },
    clear: boom,
    getItem: boom,
    key: boom,
    removeItem: boom,
    setItem: boom,
  };
}

describe('tutorial-store', () => {
  let store: TutorialStore;

  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
    store = createTutorialStore();
  });

  it('activates at step zero with nothing revealed on a first visit', () => {
    store.getState().begin();

    const state = store.getState();
    expect(state.active).toBe(true);
    expect(state.stepIndex).toBe(0);
    expect(state.revealed.size).toBe(0);
    expect(state.completed).toBe(false);
  });

  it('advance moves to the next step without revealing anything by itself', () => {
    store.getState().begin();
    store.getState().advance();

    const state = store.getState();
    expect(state.stepIndex).toBe(1);
    expect(state.revealed.size).toBe(0);
  });

  it('reveal adds one panel and leaves the others hidden', () => {
    store.getState().begin();
    store.getState().reveal('health');

    const state = store.getState();
    expect(state.revealed.has('health')).toBe(true);
    expect(state.revealed.has('actions')).toBe(false);
    expect(state.revealed.size).toBe(1);
  });

  it('revealing the same panel twice is a no-op', () => {
    store.getState().begin();
    store.getState().reveal('health');
    store.getState().reveal('health');

    expect(store.getState().revealed.size).toBe(1);
  });

  it('revealAll unlocks every panel without ending the tutorial', () => {
    store.getState().begin();
    store.getState().revealAll();

    const state = store.getState();
    expect(state.revealed.size).toBe(ALL_PANELS.length);
    expect(state.active).toBe(true);
  });

  it('complete reveals every panel, deactivates, and persists the flag', () => {
    store.getState().begin();
    store.getState().complete();

    const state = store.getState();
    expect(state.active).toBe(false);
    expect(state.completed).toBe(true);
    for (const panel of ALL_PANELS) {
      expect(state.revealed.has(panel)).toBe(true);
    }
    expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).not.toBeNull();
  });

  it('a repeat visit reveals everything and never activates the dialogue', () => {
    store.getState().begin();
    store.getState().complete();

    // A fresh store models a page reload: memory gone, localStorage intact.
    const reloaded = createTutorialStore();
    reloaded.getState().begin();

    const state = reloaded.getState();
    expect(state.active).toBe(false);
    expect(state.completed).toBe(true);
    expect(state.revealed.size).toBe(ALL_PANELS.length);
  });

  it('restart clears the persisted flag and rewinds to an active step zero', () => {
    store.getState().begin();
    store.getState().complete();
    store.getState().restart();

    const state = store.getState();
    expect(state.active).toBe(true);
    expect(state.stepIndex).toBe(0);
    expect(state.revealed.size).toBe(0);
    expect(state.completed).toBe(false);
    expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBeNull();
  });

  it('a restarted tutorial runs again after a reload', () => {
    store.getState().begin();
    store.getState().complete();
    store.getState().restart();

    const reloaded = createTutorialStore();
    reloaded.getState().begin();

    expect(reloaded.getState().active).toBe(true);
  });

  it('skipForSession stands the tutorial down without remembering it', () => {
    store.getState().skipForSession();
    store.getState().begin();

    const state = store.getState();
    expect(state.active).toBe(false);
    expect(state.revealed.size).toBe(ALL_PANELS.length);
    // The hands-free demo must not cost a curious player their tutorial.
    expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBeNull();
  });

  it('a session skip is forgotten on the next reload', () => {
    store.getState().skipForSession();

    const reloaded = createTutorialStore();
    reloaded.getState().begin();

    expect(reloaded.getState().active).toBe(true);
  });

  it('degrades to showing the tutorial when storage throws', () => {
    vi.stubGlobal('localStorage', hostileStorage());
    const hostile = createTutorialStore();

    expect(() => hostile.getState().begin()).not.toThrow();
    expect(hostile.getState().active).toBe(true);
  });

  it('does not throw when completing while storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    const headless = createTutorialStore();
    headless.getState().begin();

    expect(() => headless.getState().complete()).not.toThrow();
    expect(headless.getState().revealed.size).toBe(ALL_PANELS.length);
  });
});
