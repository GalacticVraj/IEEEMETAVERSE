import type { ZoneId } from '@app-types';
import { create } from 'zustand';

/** A selectable 3D asset — feeds the AssetInspector. */
export interface SelectedAsset {
  readonly kind: 'line' | 'bus' | 'generator' | 'building';
  readonly id: string;
}

/**
 * UI-ONLY state (selection, panel visibility). The UI legitimately OWNS this —
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
  readonly selectZone: (zone: ZoneId | null) => void;
  readonly selectAsset: (asset: SelectedAsset | null) => void;
  readonly toggleDebugOverlay: () => void;
  readonly setActivePanel: (panel: string | null) => void;
  readonly toggleSound: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  selectedZone: null,
  selectedAsset: null,
  debugOverlayVisible: false,
  activePanel: null,
  soundMuted: false,
  selectZone: (zone) => {
    set({ selectedZone: zone });
  },
  selectAsset: (asset) => {
    set({ selectedAsset: asset });
  },
  toggleDebugOverlay: () => {
    set((state) => ({ debugOverlayVisible: !state.debugOverlayVisible }));
  },
  setActivePanel: (panel) => {
    set({ activePanel: panel });
  },
  toggleSound: () => {
    set((state) => ({ soundMuted: !state.soundMuted }));
  },
}));
