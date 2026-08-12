import type { ZoneId } from '@app-types';
import { create } from 'zustand';

/** A selectable 3D asset — feeds the AssetInspector. */
export interface SelectedAsset {
  readonly kind: 'line' | 'bus' | 'generator' | 'building';
  readonly id: string;
}

/**
 * UI-ONLY state (selection, panel visibility, onboarding tour). The UI legitimately OWNS this —
 * it is not simulation state and never feeds back into the engine. Keeping it
 * separate from the simulation projection preserves the ownership boundary.
 */
export interface UiState {
  readonly selectedZone: ZoneId | null;
  readonly selectedAsset: SelectedAsset | null;
  readonly debugOverlayVisible: boolean;
  readonly activePanel: string | null;
  /** Master sound toggle for the synthesized audio layer. */
  readonly soundMuted: boolean;
  /** Progressive onboarding guided tour state. */
  readonly onboardingActive: boolean;
  readonly onboardingStep: number;
  readonly selectZone: (zone: ZoneId | null) => void;
  readonly selectAsset: (asset: SelectedAsset | null) => void;
  readonly toggleDebugOverlay: () => void;
  readonly setDebugOverlay: (visible: boolean) => void;
  readonly setActivePanel: (panel: string | null) => void;
  readonly toggleSound: () => void;
  readonly startOnboarding: () => void;
  readonly nextOnboardingStep: () => void;
  readonly prevOnboardingStep: () => void;
  readonly setOnboardingStep: (step: number) => void;
  readonly endOnboarding: () => void;
}

/**
 * The debug overlay is a DEVELOPER tool and must never appear for a player.
 * It is opt-in only: `?debug` in the URL, or Ctrl+Shift+D at runtime.
 * Exported separately so it can be tested without touching `window`.
 */
export function readDebugFlagFromLocation(search: string): boolean {
  return new URLSearchParams(search).has('debug');
}

export const useUiStore = create<UiState>()((set) => ({
  selectedZone: null,
  selectedAsset: null,
  debugOverlayVisible:
    typeof window === 'undefined' ? false : readDebugFlagFromLocation(window.location.search),
  activePanel: null,
  soundMuted: false,
  onboardingActive: false,
  onboardingStep: 1,
  selectZone: (zone) => {
    set({ selectedZone: zone });
  },
  selectAsset: (asset) => {
    set({ selectedAsset: asset });
  },
  toggleDebugOverlay: () => {
    set((state) => ({ debugOverlayVisible: !state.debugOverlayVisible }));
  },
  setDebugOverlay: (visible) => {
    set({ debugOverlayVisible: visible });
  },
  setActivePanel: (panel) => {
    set({ activePanel: panel });
  },
  toggleSound: () => {
    set((state) => ({ soundMuted: !state.soundMuted }));
  },
  startOnboarding: () => {
    set({ onboardingActive: true, onboardingStep: 1 });
  },
  // Deliberately unbounded: the tour component owns its own length and calls
  // `endOnboarding` on the last step. A step count duplicated here could — and
  // did — drift out of sync with the actual number of steps.
  nextOnboardingStep: () => {
    set((state) => ({ onboardingStep: state.onboardingStep + 1 }));
  },
  prevOnboardingStep: () => {
    set((state) => ({ onboardingStep: Math.max(1, state.onboardingStep - 1) }));
  },
  setOnboardingStep: (step) => {
    set({ onboardingStep: step });
  },
  endOnboarding: () => {
    set({ onboardingActive: false, onboardingStep: 1 });
  },
}));
