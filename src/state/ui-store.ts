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
  selectZone(zone: ZoneId | null): void;
  selectAsset(asset: SelectedAsset | null): void;
  toggleDebugOverlay(): void;
  setActivePanel(panel: string | null): void;
}

export const useUiStore = create<UiState>()((set) => ({
  selectedZone: null,
  selectedAsset: null,
  debugOverlayVisible: false,
  activePanel: null,
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
}));
