import type { LineId } from '@app-types';
import { createToken } from '@core';
import type { Token, TypedEventBus } from '@core';

import type { ElectricalGraph } from '../graph';
import { BreakerPhase, createProtectionBreaker, stepBreaker } from './breaker';
import type { ProtectionBreaker } from './breaker';
import { DEFAULT_BREAKER_CONFIG, DEFAULT_RELAY_CONFIG, DEFAULT_THERMAL_CONFIG } from './config';
import type { BreakerConfig, RelayConfig, ThermalConfig } from './config';
import { PROTECTION_EVENT } from './protection-events';
import type { ProtectionEventMap } from './protection-events';
import { createRelay, stepRelay } from './relay';
import type { RelayDecision, RelayState } from './relay';
import { createThermalState, stepThermal } from './thermal';
import type { ThermalState } from './thermal';

/** Minimal per-line loading the engine reads (a power-flow result is a superset). */
export interface LineLoading {
  readonly line: LineId;
  readonly loading: number;
}

export interface ProtectionContext {
  readonly graph: ElectricalGraph;
  readonly flows: readonly LineLoading[];
  readonly tick: number;
  readonly timestepS: number;
}

export interface ProtectionCycleResult {
  readonly tick: number;
  /** Lines whose relay issued a trip this tick. */
  readonly trips: readonly LineId[];
  /** Lines whose breaker fully opened this tick (removed from the graph). */
  readonly opened: readonly LineId[];
  readonly decisions: readonly (RelayDecision & { readonly line: LineId })[];
}

export interface ProtectionEngineOptions {
  readonly events?: TypedEventBus<ProtectionEventMap>;
  readonly relayConfig?: RelayConfig;
  readonly thermalConfig?: ThermalConfig;
  readonly breakerConfig?: BreakerConfig;
}

/**
 * The Protection Engine. Each tick it observes power-flow loadings, advances the
 * thermal model, evaluates every relay, executes breaker commands, and — only
 * when a breaker fully opens — requests a CONTROLLED graph transaction to remove
 * the line. It never computes power flow and never mutates topology directly.
 */
export interface ProtectionEngine {
  /** Ensure a relay/breaker/thermal state exists for every current line. */
  register(graph: ElectricalGraph): void;
  evaluate(context: ProtectionContext): ProtectionCycleResult;
  relayFor(line: LineId): RelayState | undefined;
  breakerFor(line: LineId): ProtectionBreaker | undefined;
  thermalFor(line: LineId): ThermalState | undefined;
  relays(): readonly RelayState[];
  breakers(): readonly ProtectionBreaker[];
  thermals(): readonly ThermalState[];
}

/** DI token for the protection engine. */
export const PROTECTION_ENGINE: Token<ProtectionEngine> = createToken('ProtectionEngine');

export function createProtectionEngine(options: ProtectionEngineOptions = {}): ProtectionEngine {
  const relayConfig = options.relayConfig ?? DEFAULT_RELAY_CONFIG;
  const thermalConfig = options.thermalConfig ?? DEFAULT_THERMAL_CONFIG;
  const breakerConfig = options.breakerConfig ?? DEFAULT_BREAKER_CONFIG;
  const eventBus = options.events;

  const emit = (name: string, payload: unknown): void => {
    if (eventBus !== undefined) {
      (eventBus as unknown as { emit(n: string, p: unknown): void }).emit(name, payload);
    }
  };

  const relays = new Map<LineId, RelayState>();
  const breakers = new Map<LineId, ProtectionBreaker>();
  const thermals = new Map<LineId, ThermalState>();

  const register = (graph: ElectricalGraph): void => {
    for (const line of graph.lines()) {
      if (!relays.has(line.id)) {
        relays.set(line.id, createRelay(`relay-${String(line.id)}`, line.id, relayConfig));
        breakers.set(
          line.id,
          createProtectionBreaker(`breaker-${String(line.id)}`, line.id, breakerConfig),
        );
        thermals.set(line.id, createThermalState(line.id, thermalConfig));
      }
    }
  };

  return {
    register,
    relayFor: (line) => relays.get(line),
    breakerFor: (line) => breakers.get(line),
    thermalFor: (line) => thermals.get(line),
    relays: () => [...relays.values()],
    breakers: () => [...breakers.values()],
    thermals: () => [...thermals.values()],

    evaluate(context: ProtectionContext): ProtectionCycleResult {
      const { graph, tick, timestepS } = context;
      register(graph);
      const loadingByLine = new Map<LineId, number>(
        context.flows.map((flow) => [flow.line, flow.loading]),
      );

      const trips: LineId[] = [];
      const opened: LineId[] = [];
      const decisions: (RelayDecision & { line: LineId })[] = [];
      let relaysEvaluated = 0;

      // Iterate lines still present in the graph, in deterministic id order.
      for (const line of graph.lines()) {
        const lineId = line.id;
        const relay = relays.get(lineId);
        const breaker = breakers.get(lineId);
        const thermal = thermals.get(lineId);
        if (relay === undefined || breaker === undefined || thermal === undefined) continue;

        const loading = loadingByLine.get(lineId) ?? 0;

        // 1 · Thermal update.
        const thermalResult = stepThermal(thermal, loading, timestepS);
        thermals.set(lineId, thermalResult.thermal);
        if (thermalResult.crossedWarning) {
          emit(PROTECTION_EVENT.ThermalWarning, {
            line: lineId,
            temperatureC: thermalResult.thermal.temperatureC,
            tick,
          });
        }
        if (thermalResult.crossedCritical) {
          emit(PROTECTION_EVENT.ThermalCritical, {
            line: lineId,
            temperatureC: thermalResult.thermal.temperatureC,
            tick,
          });
        }

        // 2 · Relay logic.
        const relayResult = stepRelay(
          relay,
          {
            loading,
            thermalCritical: thermalResult.level === 'critical',
            breakerClosed: breaker.phase === BreakerPhase.Closed,
          },
          tick,
          timestepS,
        );
        relays.set(lineId, relayResult.relay);
        for (const relayEvent of relayResult.events) {
          emit(relayEvent.name, relayEvent.payload);
        }
        emit(PROTECTION_EVENT.ProtectionDecision, {
          line: lineId,
          relay: relay.id,
          trip: relayResult.decision.trip,
          reason: relayResult.decision.reason,
          tick,
        });
        decisions.push({ ...relayResult.decision, line: lineId });
        relaysEvaluated += 1;
        if (relayResult.decision.trip) trips.push(lineId);

        // 3 · Breaker command + mechanics.
        const command = relayResult.decision.trip ? 'open' : 'none';
        const breakerResult = stepBreaker(breaker, command, tick);
        breakers.set(lineId, breakerResult.breaker);
        for (const breakerEvent of breakerResult.events) {
          emit(breakerEvent.name, breakerEvent.payload);
        }
        if (breakerResult.reachedOpen) opened.push(lineId);
      }

      // 4 · The ONLY topology mutation, through one controlled transaction.
      if (opened.length > 0) {
        graph.mutate((tx) => {
          for (const lineId of opened) {
            if (graph.getLine(lineId) !== undefined) tx.removeLine(lineId);
          }
        });
      }

      emit(PROTECTION_EVENT.ProtectionEvaluationCompleted, {
        tick,
        relaysEvaluated,
        trips: trips.length,
        opened: opened.length,
      });

      return { tick, trips, opened, decisions };
    },
  };
}
