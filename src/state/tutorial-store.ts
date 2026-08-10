/**
 * tutorial-store.ts — onboarding progress and progressive panel disclosure.
 *
 * Like `ui-store`, this is UI-OWNED presentation state: which console panels
 * the player has been introduced to, and how far through the persona tutorial
 * they are. It duplicates NO simulation state, is never written by the engine,
 * and is never read by it — doctrine #1 is untouched.
 *
 * The store deliberately knows NOTHING about the dialogue script. It exposes
 * `reveal`/`advance`/`complete`; `TutorialManager` owns the beat data and
 * decides when to call them. That keeps the dependency direction clean
 * (ui → state, never state → ui) and the script unit-testable on its own.
 */
import { create } from 'zustand';

/** Every console region that can be independently disclosed. */
export type PanelId = 'command' | 'health' | 'inspect' | 'actions' | 'timeline' | 'scenario';

/** Reveal order matches the tutorial's narrative order, top of screen down. */
export const ALL_PANELS: readonly PanelId[] = [
  'command',
  'health',
  'inspect',
  'actions',
  'timeline',
  'scenario',
];

/**
 * Versioned so a future rewrite of the tutorial can force a replay for players
 * who already finished the old one.
 */
export const TUTORIAL_STORAGE_KEY = 'gridguard.tutorial.completed.v1';

/**
 * localStorage is unavailable in the node test environment and throws outright
 * in Safari private mode / with cookies blocked. Every access degrades to
 * "tutorial not yet completed", which fails safe: a player sees the tutorial
 * again rather than being locked out of it.
 */
function readCompletedFlag(): boolean {
  try {
    return globalThis.localStorage?.getItem(TUTORIAL_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function writeCompletedFlag(completed: boolean): void {
  try {
    if (completed) {
      globalThis.localStorage?.setItem(TUTORIAL_STORAGE_KEY, '1');
    } else {
      globalThis.localStorage?.removeItem(TUTORIAL_STORAGE_KEY);
    }
  } catch {
    // Persistence is a convenience, never a requirement.
  }
}

export interface TutorialState {
  /** True while the persona is actively teaching (dialogue on screen). */
  readonly active: boolean;
  /** Index into the beat script owned by `tutorial-steps`. */
  readonly stepIndex: number;
  /** Panels disclosed so far. Anything absent is hidden and untabbable. */
  readonly revealed: ReadonlySet<PanelId>;
  /** Whether this player has finished (or skipped) the tutorial before. */
  readonly completed: boolean;
  /** Stood down for this page load only — never persisted. */
  readonly suppressed: boolean;

  /** Enter tutorial mode: teach a newcomer, or hand a veteran the full console. */
  readonly begin: () => void;
  /** Move to the next beat. Revealing is a separate, explicit act. */
  readonly advance: () => void;
  readonly reveal: (panel: PanelId) => void;
  readonly revealAll: () => void;
  /** Finish or skip: unlock everything, stop teaching, remember it. */
  readonly complete: () => void;
  /**
   * Stand the tutorial down for this page load WITHOUT remembering it — used
   * by the hands-free `?demo` walkthrough, so that watching the demo never
   * costs a curious player the tutorial they haven't seen yet.
   */
  readonly skipForSession: () => void;
  /** "Replay tutorial" — forget the flag and start over from beat zero. */
  readonly restart: () => void;
}

const EVERY_PANEL = (): ReadonlySet<PanelId> => new Set(ALL_PANELS);

/**
 * Factory rather than a bare singleton so tests can model a page reload by
 * constructing a fresh store against the same localStorage — no reset seam on
 * the production object.
 */
export function createTutorialStore() {
  return create<TutorialState>()((set, get) => ({
    active: false,
    stepIndex: 0,
    revealed: new Set<PanelId>(),
    completed: false,
    suppressed: false,

    begin: () => {
      if (get().suppressed) return;
      if (readCompletedFlag()) {
        set({ active: false, completed: true, stepIndex: 0, revealed: EVERY_PANEL() });
        return;
      }
      set({ active: true, completed: false, stepIndex: 0, revealed: new Set<PanelId>() });
    },

    advance: () => set((s) => ({ stepIndex: s.stepIndex + 1 })),

    reveal: (panel) => {
      if (get().revealed.has(panel)) return;
      set((s) => {
        const next = new Set(s.revealed);
        next.add(panel);
        return { revealed: next };
      });
    },

    revealAll: () => set({ revealed: EVERY_PANEL() }),

    complete: () => {
      writeCompletedFlag(true);
      set({ active: false, completed: true, revealed: EVERY_PANEL() });
    },

    skipForSession: () => {
      set({ active: false, suppressed: true, revealed: EVERY_PANEL() });
    },

    restart: () => {
      writeCompletedFlag(false);
      set({
        active: true,
        completed: false,
        suppressed: false,
        stepIndex: 0,
        revealed: new Set<PanelId>(),
      });
    },
  }));
}

/** The app-wide instance. */
export const useTutorialStore = createTutorialStore();
