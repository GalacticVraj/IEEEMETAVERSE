/**
 * app-flow-store.ts — The five-mode state machine for GridGuard.
 *
 * Flow: Hero → Explore → CrisisSelect → ActiveCrisis → AfterAction
 * Implemented as a simple enum in zustand (no xstate dependency needed).
 * The camera and 3D scene persist across all modes; only the HUD changes.
 */
import { create } from 'zustand';

export enum AppMode {
  Hero = 'Hero',
  Explore = 'Explore',
  CrisisSelect = 'CrisisSelect',
  ActiveCrisis = 'ActiveCrisis',
  AfterAction = 'AfterAction',
}

export interface CrisisCard {
  id: string;
  label: string;
  icon: string;
  description: string;
  recommended?: boolean;
}

export const CRISIS_CARDS: CrisisCard[] = [
  { id: 'heatwave', label: 'Heatwave', icon: '🌡️', description: 'AC demand spikes citywide as temperatures climb.' },
  { id: 'price_spike', label: 'Price Spike', icon: '⚡', description: 'Generation capacity effectively shrinks under cost pressure.' },
  { id: 'demand_surge', label: 'Demand Surge', icon: '🔌', description: 'EV charging and AC load spike suddenly in 2–3 zones.' },
];

export type BuildingType = 'hospital' | 'school' | 'corporate' | 'ev_station' | 'house_high' | 'house_low' | 'solar_farm';

export interface InspectCard {
  name: string;
  type: BuildingType;
  currentConsumptionKw: number;
  status: 'normal' | 'warning' | 'critical' | 'blackout';
  flavorText: string;
  teachingNote: string;
  incomeTier?: 'low' | 'high';
  equityNote?: string;
}

export interface AppFlowState {
  mode: AppMode;
  selectedCrisis: string | null;
  inspectedBuilding: InspectCard | null;
  hasInspectedAny: boolean;
  exploreEnteredAt: number;
  crisisResult: 'success' | 'blackout' | null;
  decisionLog: Array<{ action: string; zone: string; outcome: string }>;
  postmortemNarrative: string | null;

  // Actions
  enterCity: () => void;
  openInspectCard: (card: InspectCard) => void;
  closeInspectCard: () => void;
  enterSimulation: () => void;
  selectCrisis: (id: string) => void;
  resolveCrisis: (result: 'success' | 'blackout') => void;
  logDecision: (entry: { action: string; zone: string; outcome: string }) => void;
  setPostmortem: (narrative: string) => void;
  replay: () => void;
}

export const useAppFlowStore = create<AppFlowState>()((set) => ({
  mode: AppMode.Hero,
  selectedCrisis: null,
  inspectedBuilding: null,
  hasInspectedAny: false,
  exploreEnteredAt: 0,
  crisisResult: null,
  decisionLog: [],
  postmortemNarrative: null,

  enterCity: () => set({ mode: AppMode.Explore, exploreEnteredAt: Date.now() }),
  openInspectCard: (card) => set({ inspectedBuilding: card, hasInspectedAny: true }),
  closeInspectCard: () => set({ inspectedBuilding: null }),
  enterSimulation: () => set({ mode: AppMode.CrisisSelect }),
  selectCrisis: (id) => set({ selectedCrisis: id, mode: AppMode.ActiveCrisis }),
  resolveCrisis: (result) => set({ crisisResult: result, mode: AppMode.AfterAction }),
  logDecision: (entry) => set((s) => ({ decisionLog: [...s.decisionLog, entry] })),
  setPostmortem: (narrative) => set({ postmortemNarrative: narrative }),
  replay: () => set({
    mode: AppMode.CrisisSelect,
    crisisResult: null,
    decisionLog: [],
    postmortemNarrative: null,
    selectedCrisis: null,
  }),
}));
