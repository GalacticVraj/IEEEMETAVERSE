/**
 * `EventLogStore` — the projection feeding the Timeline and LearningFeedback.
 *
 * Every entry originates from a REAL bus event; nothing here is invented.
 * Entries carry teaching copy (what/why/action) so the UI can explain each
 * event without re-deriving simulation facts. Per-zone and weather events are
 * deduped to STATE CHANGES — the engine re-emits ZonePowered every tick, which
 * would otherwise flood the log.
 */
import { GRID_EVENT } from '@constants';
import type { GridEventBus, Unsubscribe } from '@core';
import { create } from 'zustand';

export type EventSeverity = 'info' | 'caution' | 'warning' | 'critical' | 'recovery';

export interface EventLogEntry {
  readonly seq: number;
  readonly tick: number;
  readonly severity: EventSeverity;
  readonly title: string;
  readonly detail: string;
  /** Teaching copy — what happened, why, and what the operator can do. */
  readonly what: string;
  readonly why: string;
  readonly action: string;
}

const RING_CAPACITY = 200;

interface EventLogState {
  readonly entries: readonly EventLogEntry[];
  /** Selected entry (Timeline click) for the LearningFeedback card. */
  readonly focusedSeq: number | null;
  readonly focusEntry: (seq: number | null) => void;
  readonly clear: () => void;
}

export const useEventLogStore = create<EventLogState>()((set) => ({
  entries: [],
  focusedSeq: null,
  focusEntry: (seq) => set({ focusedSeq: seq }),
  clear: () => set({ entries: [], focusedSeq: null }),
}));

let seqCounter = 0;

const push = (tick: number, entry: Omit<EventLogEntry, 'seq' | 'tick'>): void => {
  seqCounter += 1;
  const full: EventLogEntry = { seq: seqCounter, tick, ...entry };
  useEventLogStore.setState((s) => ({
    entries:
      s.entries.length >= RING_CAPACITY
        ? [...s.entries.slice(s.entries.length - RING_CAPACITY + 1), full]
        : [...s.entries, full],
  }));
};

const WEATHER_COPY: Record<string, { severity: EventSeverity; why: string; action: string }> = {
  Heatwave: {
    severity: 'caution',
    why: 'Extreme heat drives air-conditioning demand up while thermal limits on lines and plants tighten.',
    action: 'Watch corridor stress and reduce non-essential cooling load early.',
  },
  Storm: {
    severity: 'caution',
    why: 'High winds and lightning threaten transmission lines and can force wind farms to shut down.',
    action: 'Expect line trips; keep reserve generation ready.',
  },
  Clear: {
    severity: 'info',
    why: 'Mild conditions: demand relaxes and solar output is strong.',
    action: 'Good window to restore any tripped equipment.',
  },
  Overcast: {
    severity: 'info',
    why: 'Cloud cover cuts solar output; other sources must fill the gap.',
    action: 'Check the renewable share and dispatchable reserve.',
  },
  Cold: {
    severity: 'info',
    why: 'Cold snaps raise heating demand, mostly in residential zones.',
    action: 'Watch residential feeders in the north and south.',
  },
};

/**
 * Bind the event log to the bus. Call once at bootstrap; returns a detach.
 * The bus is tick-aware, so we read the tick from each event's metadata via
 * the SimulationTick-updated counter kept here.
 */
export function bindEventLog(bus: GridEventBus): Unsubscribe {
  let currentTick = 0;
  let lastWeatherKind: string | null = null;
  const zoneStates = new Map<string, 'Powered' | 'Blackout'>();

  const subs: Unsubscribe[] = [
    bus.on(GRID_EVENT.SimulationTick, (p) => {
      currentTick = p.tick;
    }),

    bus.on(GRID_EVENT.WeatherChanged, (p) => {
      const kind = p.kind as string;
      if (kind === lastWeatherKind) return;
      lastWeatherKind = kind;
      const copy = WEATHER_COPY[kind] ?? WEATHER_COPY['Clear']!;
      push(currentTick, {
        severity: copy.severity,
        title: `Weather: ${kind}`,
        detail: `${Math.round(p.temperature)} °C`,
        what: `The weather shifted to ${kind.toLowerCase()} conditions (${Math.round(p.temperature)} °C).`,
        why: copy.why,
        action: copy.action,
      });
    }),

    bus.on(GRID_EVENT.LineTripped, (p) => {
      push(currentTick, {
        severity: 'critical',
        title: `Line ${String(p.line)} tripped`,
        detail: `cause: ${String(p.cause)}`,
        what: `Transmission line ${String(p.line)} opened and stopped carrying power.`,
        why:
          p.cause === 'Overload'
            ? 'Its protective relay detected current above the thermal limit and opened the breaker before the conductor could be damaged.'
            : 'Its breaker was opened by command or as part of a wider disturbance.',
        action: 'Power reroutes over neighboring corridors — watch them for follow-on overloads, and reduce demand feeding this corridor.',
      });
    }),

    bus.on(GRID_EVENT.LineRecovered, (p) => {
      push(currentTick, {
        severity: 'recovery',
        title: `Line ${String(p.line)} reclosing`,
        detail: 'conductor cooled below limit',
        what: `Line ${String(p.line)} cooled down and its breaker is closing again.`,
        why: 'Once conductor temperature falls back under the warning threshold, the line can safely carry power again.',
        action: 'Loading should redistribute — confirm corridor stress falls.',
      });
    }),

    bus.on(GRID_EVENT.CascadeStarted, (p) => {
      push(currentTick, {
        severity: 'critical',
        title: 'Cascade risk',
        detail: `origin: ${String(p.originLine)}`,
        what: `A chain of overloads is spreading from line ${String(p.originLine)}.`,
        why: 'Each trip pushes its power onto neighbors, which can overload and trip in turn — the classic blackout mechanism.',
        action: 'Shed load NOW to break the chain before more lines trip.',
      });
    }),

    bus.on(GRID_EVENT.CascadeEnded, (p) => {
      push(currentTick, {
        severity: p.contained ? 'recovery' : 'warning',
        title: p.contained ? 'Cascade contained' : 'Cascade ended',
        detail: `${p.totalSteps} step(s)`,
        what: `The overload chain stopped after ${p.totalSteps} step(s).`,
        why: p.contained
          ? 'Remaining corridors had enough spare capacity to absorb the rerouted power.'
          : 'The cascade ran until sections of the grid separated.',
        action: 'Assess which corridors are still out and plan restoration.',
      });
    }),

    bus.on(GRID_EVENT.ZoneBlackout, (p) => {
      const zone = String(p.zone);
      if (zoneStates.get(zone) === 'Blackout') return;
      zoneStates.set(zone, 'Blackout');
      push(currentTick, {
        severity: 'critical',
        title: `Blackout: ${zone}`,
        detail: `${Math.round(p.unservedLoad)} MW unserved`,
        what: `Zone ${zone} lost power — ${Math.round(p.unservedLoad)} MW of demand is unserved.`,
        why: 'Every energized path into the zone was lost, so its buses are de-energized.',
        action: 'Restore a transmission path into the zone; critical loads are on limited backup.',
      });
    }),

    bus.on(GRID_EVENT.ZonePowered, (p) => {
      const zone = String(p.zone);
      const prev = zoneStates.get(zone);
      zoneStates.set(zone, 'Powered');
      if (prev !== 'Blackout') return; // baseline powered state is not news
      push(currentTick, {
        severity: 'recovery',
        title: `Power restored: ${zone}`,
        detail: 'zone re-energized',
        what: `Zone ${zone} is receiving power again.`,
        why: 'A transmission path into the zone was re-established.',
        action: 'Ramp demand back gradually — a cold-load pickup surge can re-trip lines.',
      });
    }),

    bus.on(GRID_EVENT.DecisionRequested, (p) => {
      push(currentTick, {
        severity: 'warning',
        title: 'Operator decision needed',
        detail: p.prompt.slice(0, 80),
        what: p.prompt,
        why: 'The grid reached a condition your standing procedures cannot resolve automatically.',
        action: 'Choose an intervention from the operator actions panel.',
      });
    }),

    bus.on(GRID_EVENT.DecisionCommitted, (p) => {
      push(currentTick, {
        severity: 'info',
        title: 'Decision committed',
        detail: String(p.decisionId),
        what: 'Your intervention was dispatched to the grid.',
        why: 'Operator actions change load or topology on the next solver pass.',
        action: 'Watch the balance and corridor stress respond over the next seconds.',
      });
    }),

    bus.on(GRID_EVENT.GameEnded, (p) => {
      push(currentTick, {
        severity: p.outcome === 'Held' ? 'recovery' : 'critical',
        title: p.outcome === 'Held' ? 'Grid held' : `Run ended: ${p.outcome}`,
        detail: `score ${p.score}`,
        what:
          p.outcome === 'Held'
            ? 'You kept Meridian Bay powered through the crisis.'
            : 'The grid lost one or more zones for too long.',
        why:
          p.outcome === 'Held'
            ? 'Generation, demand, and corridor limits stayed in balance to the end.'
            : 'Demand exceeded what the surviving network could deliver.',
        action: 'Review the timeline to see which decision points mattered.',
      });
    }),
  ];

  return () => {
    for (const u of subs) u();
  };
}
