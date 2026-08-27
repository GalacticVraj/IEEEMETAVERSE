/**
 * banner-store.ts — the alert stack.
 *
 * UI-only state, and legitimately so: "which alert is currently on screen and
 * for how long" is not a property of the grid, it is a property of the
 * console. Nothing here computes or caches simulation state — every banner is
 * pushed by an observer of a real escalation or a real bus event, and carries
 * the measured reason that caused it.
 *
 * The stack is capped at three. A cascade can produce a dozen notable events
 * in as many seconds; stacking them all would bury the city under its own
 * alarm log at the exact moment the player needs to see it.
 */
import { create } from 'zustand';

/** Banner severities map onto the frozen semantic palette, never new colours. */
export type BannerTone = 'info' | 'warning' | 'critical' | 'blackout' | 'recovery';

export interface Banner {
  readonly id: number;
  readonly tone: BannerTone;
  /** Short, shouted: "FREQUENCY ALERT". */
  readonly title: string;
  /** The measured cause, in a sentence: "59.42 Hz, RoCoF −0.31 Hz/s". */
  readonly detail: string;
  /**
   * Collapses repeats of the same real-world condition. A second push with a
   * live key refreshes the existing banner rather than stacking a duplicate.
   */
  readonly dedupeKey: string;
}

/** How long a banner stays before it slides out, ms. */
export const BANNER_LIFETIME_MS = 4000;
/** Never show more than this many at once. */
export const BANNER_STACK_LIMIT = 3;

export interface BannerState {
  /** Newest first — the top of the stack is the most recent alert. */
  readonly banners: readonly Banner[];
  readonly push: (banner: Omit<Banner, 'id'>) => void;
  readonly dismiss: (id: number) => void;
  readonly clear: () => void;
}

let nextId = 1;

export const useBannerStore = create<BannerState>()((set, get) => ({
  banners: [],

  push: (banner) => {
    const existing = get().banners.find((b) => b.dedupeKey === banner.dedupeKey);
    if (existing !== undefined) {
      // Same condition, still on screen: refresh its text in place. Pushing a
      // duplicate would let one flapping corridor own the entire stack.
      set((s) => ({
        banners: s.banners.map((b) =>
          b.id === existing.id ? { ...b, ...banner, id: existing.id } : b,
        ),
      }));
      return;
    }

    const id = nextId++;
    set((s) => ({ banners: [{ ...banner, id }, ...s.banners].slice(0, BANNER_STACK_LIMIT) }));

    // The timer lives here rather than in the component so a banner survives
    // its own component remounting (mode changes remount the overlay tree).
    setTimeout(() => {
      get().dismiss(id);
    }, BANNER_LIFETIME_MS);
  },

  dismiss: (id) => {
    set((s) => ({ banners: s.banners.filter((b) => b.id !== id) }));
  },

  clear: () => {
    set({ banners: [] });
  },
}));

/** Test seam: reset the id counter so assertions are not order-dependent. */
export function resetBannerIds(): void {
  nextId = 1;
}
