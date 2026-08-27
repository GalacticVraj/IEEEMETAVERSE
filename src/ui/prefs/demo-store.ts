/**
 * demo-store.ts — is the hands-free demo running, and should it loop?
 *
 * UI-only state. `presentation` is the unattended mode a judge leaves running:
 * it speeds the clock, shows a watermark so nobody mistakes an automated run
 * for a played one, and restarts from the hero screen when the review ends.
 */
import { create } from 'zustand';

export interface DemoState {
  /** True while the scripted driver is pressing buttons. */
  readonly active: boolean;
  /** True in unattended presentation mode: watermark, faster clock, loop. */
  readonly presentation: boolean;
  readonly setActive: (active: boolean) => void;
  readonly setPresentation: (presentation: boolean) => void;
}

export const useDemoStore = create<DemoState>()((set) => ({
  active: false,
  presentation: false,
  setActive: (active) => {
    set({ active });
  },
  setPresentation: (presentation) => {
    set({ presentation });
  },
}));

/** Demo playback rate. Fast enough to hold a room, slow enough to follow. */
export const PRESENTATION_SPEED = 1.5;
