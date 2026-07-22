/**
 * app-flow-store.ts — The five-mode state machine for GridGuard.
 *
 * Flow: Hero → Explore → CrisisSelect → ActiveCrisis → AfterAction
 * Implemented as a simple enum in zustand (no xstate dependency needed).
 * The camera and 3D scene persist across all modes; only the HUD changes.
 */
import { GRID_EVENT } from '@constants';
import type { GridEventBus, Unsubscribe } from '@core';
import { create } from 'zustand';

export enum AppMode {
  Hero = 'Hero',
  Arrival = 'Arrival',
  Explore = 'Explore',
  Briefing = 'Briefing',
  CrisisSelect = 'CrisisSelect',
  ActiveCrisis = 'ActiveCrisis',
  AfterAction = 'AfterAction',
}

export interface CrisisCard {
  id: string;
  label: string;
  difficulty: string;
  description: string;
  recommended?: boolean;
}

/**
 * Crisis cards mirror REAL registered scenarios: ids match the scenario
 * registry, descriptions come from each scenario's `metadata.summary`.
 */
export const CRISIS_CARDS: CrisisCard[] = [
  {
    id: 'heatwave',
    label: 'Record Heatwave',
    difficulty: 'Warning',
    description:
      'A record heatwave drives cooling demand past safe limits across Meridian Bay, '
      + 'then a baseload generator trips its cooling system, forcing the grid toward cascade failure.',
    recommended: true,
  },
  {
    id: 'storm',
    label: 'Coastal Storm',
    difficulty: 'Critical',
    description:
      'A violent coastal storm trips critical transmission lines via lightning and flashover, '
      + 'while the wind farm ultimately shuts down on overspeed, fragmenting the grid.',
  },
  {
    id: 'equipment-failure',
    label: 'Transformer Differential Fault',
    difficulty: 'Warning',
    description:
      'A transformer internal fault trips the DT4-HB1 main infeed, forcing power '
      + 're-routing that thermally overloads backup paths in sequential failure.',
  },
];

export type BuildingType = 'hospital' | 'school' | 'corporate' | 'ev_station' | 'house_high' | 'house_low' | 'solar_farm' | 'courthouse';

export interface InspectCard {
  name: string;
  type: BuildingType;
  currentConsumptionKw: number;
  status: 'normal' | 'warning' | 'critical' | 'blackout';
  flavorText: string;
  teachingNote: string;
  incomeTier?: 'low' | 'high';
  equityNote?: string;
  appliances?: any[];
  priorityTier?: 1 | 2 | 3 | 4;
  priorityLabel?: string;
}

export interface Decision {
  type: string;
  label: string;
  [key: string]: any;
}

export interface DecisionLogEntry {
  tick: number;
  action: Decision;
  zoneId: string;
  zoneIncomeTier: 'low' | 'high' | null;
  alternativesConsidered: { action: Decision; projectedMaxLineLoading: number }[];
}

export interface AppFlowState {
  mode: AppMode;
  selectedCrisis: string | null;
  inspectedBuilding: InspectCard | null;
  hasInspectedAny: boolean;
  inspectedBuildingIds: Set<string>;
  exploreEnteredAt: number;
  crisisResult: 'success' | 'blackout' | null;
  decisionLog: DecisionLogEntry[];
  postmortemNarrative: string | null;

  // Actions
  enterCity: () => void;
  finishArrival: () => void;
  openInspectCard: (id: string, card: InspectCard) => void;
  closeInspectCard: () => void;
  enterBriefing: () => void;
  enterSimulation: () => void;
  selectCrisis: (id: string) => void;
  resolveCrisis: (result: 'success' | 'blackout') => void;
  logDecision: (entry: DecisionLogEntry) => void;
  setPostmortem: (narrative: string) => void;
  replay: () => void;
  returnToHero: () => void;
}

export const useAppFlowStore = create<AppFlowState>()((set) => ({
  mode: AppMode.Hero,
  selectedCrisis: null,
  inspectedBuilding: null,
  hasInspectedAny: false,
  inspectedBuildingIds: new Set<string>(),
  exploreEnteredAt: 0,
  crisisResult: null,
  decisionLog: [],
  postmortemNarrative: null,

  enterCity: () => set({ mode: AppMode.Arrival }),
  finishArrival: () => set({ mode: AppMode.Explore, exploreEnteredAt: Date.now() }),
  openInspectCard: (id, card) => set((s) => {
    const newSet = new Set(s.inspectedBuildingIds);
    newSet.add(id);
    return { inspectedBuilding: card, hasInspectedAny: true, inspectedBuildingIds: newSet };
  }),
  closeInspectCard: () => set({ inspectedBuilding: null }),
  enterBriefing: () => set({ mode: AppMode.Briefing }),
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
  returnToHero: () => set({
    mode: AppMode.Hero,
    crisisResult: null,
    decisionLog: [],
    postmortemNarrative: null,
    selectedCrisis: null,
    hasInspectedAny: false,
    exploreEnteredAt: 0,
    inspectedBuilding: null,
    inspectedBuildingIds: new Set<string>()
  }),
}));

/** The minimal session surface the flow needs — avoids a hard infra import. */
interface StoppableSession {
  stop(): void;
}

/**
 * Bind the app flow to the simulation outcome: when the director or session
 * declares the run over (GameEnded), stop real-time ticking and move the UI
 * to AfterAction with the real outcome.
 */
export function bindAppFlow(bus: GridEventBus, session: StoppableSession): Unsubscribe {
  return bus.on(GRID_EVENT.GameEnded, (payload) => {
    session.stop();
    useAppFlowStore
      .getState()
      .resolveCrisis(payload.outcome === 'Held' ? 'success' : 'blackout');
  });
}
