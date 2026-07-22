/**
 * evidence-engine.ts — turns operator decisions into MEASURED evidence.
 *
 * For every DecisionCommitted: snapshot real telemetry, wait the evaluation
 * window, snapshot again, judge by actual deltas — never by estimates — and
 * feed the Learner Twin. Also awards passive evidence for run-level facts
 * (hospital never dark, cascade contained after action, sustained renewables).
 *
 * Read-only over the simulation: it observes the bus and getState(); it never
 * mutates anything.
 */
import { asSeconds } from '@app-types';
import type { Seconds } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createToken } from '@core';
import type { GridEventBus, Token, Unsubscribe } from '@core';
import type { ISimulationEngine } from '@engine';

import type { ILearnerTwin } from '../twin/learner-twin';

import { CONCEPT, conceptsForDecision } from './concepts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TelemetrySnapshot {
  readonly tick: number;
  readonly maxLoading: number;
  readonly balanceMw: number;
  readonly darkZones: number;
  readonly unservedMw: number;
}

export type EvidenceVerdict = 'improved' | 'no-effect' | 'worsened' | 'pending';

export interface DecisionEvidence {
  readonly decisionId: string;
  readonly optionIndex: number;
  readonly simTime: Seconds;
  readonly tick: number;
  readonly concepts: readonly string[];
  readonly responseTimeS: number;
  readonly pre: TelemetrySnapshot;
  readonly post: TelemetrySnapshot | null;
  readonly verdict: EvidenceVerdict;
}

export interface IEvidenceEngine {
  start(): void;
  stop(): void;
  reset(): void;
  records(): readonly DecisionEvidence[];
  /** Subscribe to finalized records (advisor feedback, after-action). */
  onRecord(listener: (record: DecisionEvidence) => void): Unsubscribe;
}

export const EVIDENCE_ENGINE: Token<IEvidenceEngine> = createToken('EvidenceEngine');

export interface EvidenceEngineDeps {
  readonly bus: GridEventBus;
  readonly engine: ISimulationEngine;
  readonly twin: ILearnerTwin;
  /** Evaluation window in ticks (default 50 = 5 s of sim time). */
  readonly windowTicks?: number;
}

// Measured-change thresholds — below these a delta is treated as noise.
const LOADING_DELTA = 0.02;
const BALANCE_DELTA_MW = 20;
const UNSERVED_DELTA_MW = 1;
/** Sustained renewable share counting as real renewable integration. */
const RENEWABLE_SHARE_BAR = 0.25;
/** A cascade contained within this window after a decision credits the operator. */
const CASCADE_CREDIT_TICKS = 300;

const DEFAULT_WINDOW_TICKS = 50;

export function createEvidenceEngine(deps: EvidenceEngineDeps): IEvidenceEngine {
  const { bus, engine, twin } = deps;
  const windowTicks = deps.windowTicks ?? DEFAULT_WINDOW_TICKS;

  interface Pending {
    readonly evidence: Omit<DecisionEvidence, 'post' | 'verdict'>;
    readonly matureAt: number;
  }

  let subs: Unsubscribe[] = [];
  let pending: Pending[] = [];
  let finalized: DecisionEvidence[] = [];
  const listeners = new Set<(record: DecisionEvidence) => void>();
  const requestedAt = new Map<string, number>(); // decisionId → tick

  let currentTick = 0;
  let lastDecisionTick = -Infinity;
  let hospitalZoneWentDark = false;
  let renewableShareSum = 0;
  let renewableShareSamples = 0;
  let runScored = false;

  const snapshot = (): TelemetrySnapshot => {
    const state = engine.getState();
    let maxLoading = 0;
    for (const line of state.lines) {
      maxLoading = Math.max(maxLoading, line.loading);
    }
    let darkZones = 0;
    let unservedMw = 0;
    for (const zone of state.zones) {
      if ((zone.state as string) === 'Blackout') darkZones += 1;
      unservedMw += zone.unservedLoad as number;
    }
    return {
      tick: currentTick,
      maxLoading,
      balanceMw: (state.totalGeneration as number) - (state.totalLoad as number),
      darkZones,
      unservedMw,
    };
  };

  const judge = (pre: TelemetrySnapshot, post: TelemetrySnapshot): EvidenceVerdict => {
    const improved =
      pre.maxLoading - post.maxLoading >= LOADING_DELTA ||
      pre.unservedMw - post.unservedMw >= UNSERVED_DELTA_MW ||
      pre.darkZones - post.darkZones >= 1 ||
      post.balanceMw - pre.balanceMw >= BALANCE_DELTA_MW;
    if (improved) return 'improved';
    const worsened =
      post.maxLoading - pre.maxLoading >= LOADING_DELTA ||
      post.unservedMw - pre.unservedMw >= UNSERVED_DELTA_MW ||
      post.darkZones - pre.darkZones >= 1;
    return worsened ? 'worsened' : 'no-effect';
  };

  const finalize = (entry: Pending): void => {
    const post = snapshot();
    const verdict = judge(entry.evidence.pre, post);
    const record: DecisionEvidence = { ...entry.evidence, post, verdict };
    finalized.push(record);
    twin.observeDecision({
      decisionId: record.decisionId as never,
      optionIndex: record.optionIndex,
      simTime: record.simTime,
      concepts: record.concepts,
      optimal: verdict === 'improved',
      responseTime: asSeconds(record.responseTimeS),
    });
    for (const listener of listeners) listener(record);
  };

  const reset = (): void => {
    pending = [];
    finalized = [];
    requestedAt.clear();
    lastDecisionTick = -Infinity;
    hospitalZoneWentDark = false;
    renewableShareSum = 0;
    renewableShareSamples = 0;
    runScored = false;
  };

  const start = (): void => {
    if (subs.length > 0) return;
    subs = [
      bus.on(GRID_EVENT.SimulationTick, (p) => {
        if (p.tick < currentTick) reset(); // scenario restart
        currentTick = p.tick;

        const state = engine.getState();
        const totalGen = state.totalGeneration as number;
        if (totalGen > 0) {
          renewableShareSum += (state.renewableGeneration as number) / totalGen;
          renewableShareSamples += 1;
        }

        while (pending.length > 0 && pending[0] !== undefined && currentTick >= pending[0].matureAt) {
          const entry = pending.shift();
          if (entry !== undefined) finalize(entry);
        }
      }),

      bus.on(GRID_EVENT.DecisionRequested, (p) => {
        requestedAt.set(String(p.decisionId), currentTick);
      }),

      bus.on(GRID_EVENT.DecisionCommitted, (p) => {
        const id = String(p.decisionId);
        const askedAt = requestedAt.get(id);
        lastDecisionTick = currentTick;
        pending.push({
          matureAt: currentTick + windowTicks,
          evidence: {
            decisionId: id,
            optionIndex: p.optionIndex,
            simTime: p.simTime,
            tick: currentTick,
            concepts: conceptsForDecision(id),
            responseTimeS: askedAt === undefined ? 0 : (currentTick - askedAt) / 10,
            pre: snapshot(),
          },
        });
      }),

      bus.on(GRID_EVENT.ZoneBlackout, (p) => {
        if (String(p.zone) === 'DT') hospitalZoneWentDark = true;
        twin.noteBlackout();
      }),

      bus.on(GRID_EVENT.ZonePowered, () => {
        // Recovery credit is granted through CascadeEnded / GameEnded paths;
        // per-tick ZonePowered re-emits are not individual evidence.
      }),

      bus.on(GRID_EVENT.CascadeEnded, (p) => {
        if (p.contained && currentTick - lastDecisionTick <= CASCADE_CREDIT_TICKS) {
          twin.observePassive(CONCEPT.CascadingFailure, true);
        }
      }),

      bus.on(GRID_EVENT.GameEnded, () => {
        if (runScored) return;
        runScored = true;
        twin.noteRunCompleted();
        // Hospital district stayed powered through the whole run → real
        // evidence of protecting critical infrastructure.
        twin.observePassive(CONCEPT.Equity, !hospitalZoneWentDark);
        const avgShare =
          renewableShareSamples > 0 ? renewableShareSum / renewableShareSamples : 0;
        if (avgShare >= RENEWABLE_SHARE_BAR) {
          twin.observePassive(CONCEPT.RenewableIntegration, true);
        }
      }),
    ];
  };

  const stop = (): void => {
    for (const unsubscribe of subs) unsubscribe();
    subs = [];
  };

  return {
    start,
    stop,
    reset,
    // Finalized records first, then still-pending ones (verdict 'pending') so
    // the after-action never hides a real decision that hadn't matured yet.
    records: () => [
      ...finalized,
      ...pending.map((entry) => ({ ...entry.evidence, post: null, verdict: 'pending' as const })),
    ],
    onRecord: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
