/**
 * camera-store.ts — UI-owned camera intent state (like ui-store, this is
 * presentation state the UI legitimately owns; it duplicates NO simulation
 * state). Producers push shot REQUESTS resolved by priority; the
 * CameraDirector is the only consumer that actually moves the camera.
 *
 * Priorities: 100 intro · 95 decision · 90 selection · 80 crisis event ·
 * 70 replay (reserved) · 60 operator home · 0 manual orbit.
 */
import { create } from 'zustand';

import type { CameraPose, Shot, TimingPreset } from './shots';

export type TransitionState = 'idle' | 'moving' | 'holding' | 'returning';

/** User input suppresses event-follow shots for this long (spec: 8 s). */
export const INPUT_SUPPRESSION_MS = 8000;

export const isFollowSuppressed = (lastUserInputAt: number, now: number): boolean =>
  now - lastUserInputAt < INPUT_SUPPRESSION_MS;

export interface CameraRequest {
  readonly seq: number;
  readonly shot: Shot;
  readonly priority: number;
  readonly timing: TimingPreset;
  /** Seconds to hold on the shot before returning; omit to stay until cleared. */
  readonly holdSeconds?: number | undefined;
  /** Where the director returns after the hold. */
  readonly returnTo?: 'saved' | 'home' | 'none' | undefined;
}

export interface RequestOptions {
  readonly priority: number;
  readonly timing: TimingPreset;
  readonly holdSeconds?: number;
  readonly returnTo?: 'saved' | 'home' | 'none';
}

interface CameraStore {
  readonly request: CameraRequest | null;
  readonly transition: TransitionState;
  readonly autoFollow: boolean;
  readonly introActive: boolean;
  readonly introDone: boolean;
  readonly lastUserInputAt: number;
  readonly savedPose: CameraPose | null;
  readonly currentShotName: string | null;

  /** Push a shot request. Returns whether it was accepted (priority rules). */
  readonly requestShot: (shot: Shot, options: RequestOptions) => boolean;
  /** Director signals a request fully finished (including any return leg). */
  readonly completeRequest: (seq: number) => void;
  /** User canvas input: cancel scripted motion, stamp the input time. */
  readonly cancelScripted: (now: number) => void;
  readonly noteUserInput: (now: number) => void;
  readonly setAutoFollow: (value: boolean) => void;
  readonly setTransition: (state: TransitionState) => void;
  /** Save the pre-focus pose. First save wins until cleared. */
  readonly savePose: (pose: CameraPose) => void;
  readonly clearSavedPose: () => void;
  readonly setIntroActive: (active: boolean) => void;
  readonly markIntroDone: () => void;
  readonly setCurrentShotName: (name: string | null) => void;
}

let seqCounter = 0;

export const useCameraStore = create<CameraStore>()((set, get) => ({
  request: null,
  transition: 'idle',
  autoFollow: true,
  introActive: false,
  introDone: false,
  lastUserInputAt: -Infinity,
  savedPose: null,
  currentShotName: null,

  requestShot: (shot, options) => {
    const active = get().request;
    if (active !== null && options.priority < active.priority) return false;
    seqCounter += 1;
    set({
      request: {
        seq: seqCounter,
        shot,
        priority: options.priority,
        timing: options.timing,
        holdSeconds: options.holdSeconds,
        returnTo: options.returnTo,
      },
      currentShotName: shot.name,
    });
    return true;
  },

  completeRequest: (seq) => {
    const active = get().request;
    // Only clear if a newer request hasn't replaced this one mid-flight.
    if (active !== null && active.seq === seq) {
      set({ request: null, transition: 'idle', currentShotName: null });
    }
  },

  cancelScripted: (now) => {
    set({ request: null, transition: 'idle', currentShotName: null, lastUserInputAt: now });
  },

  noteUserInput: (now) => set({ lastUserInputAt: now }),
  setAutoFollow: (value) => set({ autoFollow: value }),
  setTransition: (state) => set({ transition: state }),

  savePose: (pose) => {
    if (get().savedPose === null) set({ savedPose: pose });
  },
  clearSavedPose: () => set({ savedPose: null }),

  setIntroActive: (active) => set({ introActive: active }),
  markIntroDone: () => set({ introDone: true, introActive: false }),
  setCurrentShotName: (name) => set({ currentShotName: name }),
}));
