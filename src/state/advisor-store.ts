/**
 * `AdvisorStore` — the in-play mentor's voice. Deterministic, evidence-only:
 * every message is assembled from real bus events or measured decision
 * records; nothing is invented. Max one message per cooldown window,
 * dismissible, presentation-layer state (like ui-store).
 */
import { GRID_EVENT } from '@constants';
import type { GridEventBus, Unsubscribe } from '@core';
import { create } from 'zustand';

export type AdvisorMessageKind = 'question' | 'explanation' | 'reinforcement' | 'feedback';

export interface AdvisorMessage {
  readonly id: number;
  readonly kind: AdvisorMessageKind;
  readonly text: string;
}

interface AdvisorState {
  readonly current: AdvisorMessage | null;
  readonly lastShownAt: number;
  readonly dismiss: () => void;
}

export const useAdvisorStore = create<AdvisorState>()((set) => ({
  current: null,
  lastShownAt: -Infinity,
  dismiss: () => set({ current: null }),
}));

/** Spec: at most one advisor message every 20 seconds. */
export const ADVISOR_COOLDOWN_MS = 20_000;
/** Corridor stress crossing this asks the "what happens next?" question. */
const STRESS_QUESTION_BAR = 0.9;

let messageCounter = 0;

const ZONE_NAMES: Record<string, string> = {
  DT: 'Downtown',
  IN: 'Industrial',
  RN: 'Residential North',
  RS: 'Residential South',
  AP: 'Airport',
  HB: 'Harbor',
};

const DECISION_LABELS: readonly { prefix: string; label: string }[] = [
  { prefix: 'op-ac-residential', label: 'Reduce residential AC' },
  { prefix: 'op-ev-pause', label: 'Pause public EV charging' },
  { prefix: 'op-lights-commercial', label: 'Dim commercial lighting' },
  { prefix: 'op-shed-industrial', label: 'Controlled industrial shed' },
  { prefix: 'op-shed-harbor', label: 'Emergency harbor shed' },
];

const labelForDecision = (decisionId: string): string => {
  for (const entry of DECISION_LABELS) {
    if (decisionId.startsWith(entry.prefix)) return entry.label;
  }
  return 'Your intervention';
};

const clock = (tick: number): string => {
  const totalSeconds = Math.floor(tick / 10);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `T+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const show = (kind: AdvisorMessageKind, text: string, now: number): boolean => {
  const state = useAdvisorStore.getState();
  if (now - state.lastShownAt < ADVISOR_COOLDOWN_MS) return false;
  messageCounter += 1;
  useAdvisorStore.setState({
    current: { id: messageCounter, kind, text },
    lastShownAt: now,
  });
  return true;
};

/**
 * Measured decision feedback (bridged from the EvidenceEngine by bootstrap).
 * The numbers are the REAL before/after corridor stress readings.
 */
export function pushEvidenceFeedback(
  record: {
    readonly decisionId: string;
    readonly verdict: string;
    readonly pre: { readonly maxLoading: number };
    readonly post: { readonly maxLoading: number } | null;
  },
  now: number,
): void {
  if (record.post === null) return;
  const label = labelForDecision(record.decisionId);
  const prePct = Math.round(record.pre.maxLoading * 100);
  const postPct = Math.round(record.post.maxLoading * 100);
  let text: string;
  if (record.verdict === 'improved') {
    text = `Measured: “${label}” worked — peak corridor stress went from ${prePct} % to ${postPct} %.`;
  } else if (record.verdict === 'worsened') {
    text = `Measured: after “${label}”, peak corridor stress rose from ${prePct} % to ${postPct} %. The grid needed a different lever.`;
  } else {
    text = `Measured: “${label}” had no measurable effect within the evaluation window (stress ${prePct} % → ${postPct} %).`;
  }
  show('feedback', text, now);
}

export interface AdvisorDeps {
  /** Injected clock (performance.now in the app; fake in tests). */
  readonly now: () => number;
}

/** Bind the advisor's moment detectors to the bus. Returns a detach. */
export function bindAdvisor(bus: GridEventBus, deps: AdvisorDeps): Unsubscribe {
  const { now } = deps;
  let currentTick = 0;
  let previousMaxLoading = 0;
  let explainedFirstTrip = false;
  const darkZones = new Set<string>();

  const subs: Unsubscribe[] = [
    bus.on(GRID_EVENT.SimulationTick, (p) => {
      if (p.tick < currentTick) {
        // Run restart — re-arm one-shot moments.
        explainedFirstTrip = false;
        previousMaxLoading = 0;
        darkZones.clear();
      }
      currentTick = p.tick;
    }),

    bus.on(GRID_EVENT.PowerFlowSolved, (p) => {
      const loading = p.maxLoading as number;
      if (previousMaxLoading < STRESS_QUESTION_BAR && loading >= STRESS_QUESTION_BAR) {
        show(
          'question',
          `Corridor stress just reached ${Math.round(loading * 100)} %. If demand keeps climbing, protection will start opening lines — which flexible load would you trim first?`,
          now(),
        );
      }
      previousMaxLoading = loading;
    }),

    bus.on(GRID_EVENT.LineTripped, (p) => {
      if (explainedFirstTrip) {
        show(
          'explanation',
          `Line ${String(p.line)} tripped at ${clock(currentTick)} — its share of the flow is now rerouting over neighboring corridors.`,
          now(),
        );
        return;
      }
      explainedFirstTrip = true;
      show(
        'explanation',
        `Line ${String(p.line)} tripped at ${clock(currentTick)}: sustained current above its thermal limit heated the conductor past its safe operating point, so its relay opened the breaker. The power it carried now flows over neighboring corridors — watch their loading.`,
        now(),
      );
    }),

    bus.on(GRID_EVENT.ZoneBlackout, (p) => {
      darkZones.add(String(p.zone));
    }),

    bus.on(GRID_EVENT.ZonePowered, (p) => {
      const zone = String(p.zone);
      if (!darkZones.has(zone)) return;
      darkZones.delete(zone);
      show(
        'reinforcement',
        `${ZONE_NAMES[zone] ?? zone} is re-energized at ${clock(currentTick)}. Restoring a district after a blackout is the hardest maneuver in grid operations — the load you shed earlier made this pickup survivable.`,
        now(),
      );
    }),
  ];

  return () => {
    for (const unsubscribe of subs) unsubscribe();
  };
}
