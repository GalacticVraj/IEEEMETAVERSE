import type { GridEventName } from '@constants';
import type {
  Celsius,
  DecisionId,
  GameOutcome,
  GeneratorId,
  LineId,
  LineTripCause,
  MegaWatts,
  PerUnit,
  Ratio,
  Seconds,
  WeatherKind,
  ZoneId,
} from '@app-types';

import type { TypedEventBus } from './event-bus';
import type { KernelEventMap } from './kernel-events';

/*
 * ---------------------------------------------------------------------------
 * Domain event payloads. `GridEventMap` EXTENDS the kernel's `KernelEventMap`,
 * so kernel events (SimulationTick, KernelStateChanged) flow on the same bus
 * while the kernel never references these domain events.
 *
 * Payloads carry only ids, scalars, and enums — never engine model objects.
 * This keeps `core` independent of `engine`: consumers receive lightweight
 * facts and read richer detail from state projections if they need it.
 * ---------------------------------------------------------------------------
 */

export interface WeatherChangedPayload {
  readonly kind: WeatherKind;
  readonly temperature: Celsius;
  /** Solar irradiance, 0..1 of clear-sky peak. Drives Solar output. */
  readonly irradiance: Ratio;
  /** Wind availability, 0..1 of rated. Drives Wind output. */
  readonly wind: Ratio;
}

export interface LoadChangedPayload {
  readonly zone: ZoneId;
  readonly demand: MegaWatts;
}

export interface GenerationChangedPayload {
  readonly generator: GeneratorId;
  readonly output: MegaWatts;
}

export interface PowerFlowSolvedPayload {
  readonly converged: boolean;
  readonly iterations: number;
  readonly maxLoading: PerUnit;
}

export interface LineOverloadedPayload {
  readonly line: LineId;
  readonly loading: PerUnit;
}

export interface LineTripStartedPayload {
  readonly line: LineId;
  readonly delay: Seconds;
}

export interface LineTrippedPayload {
  readonly line: LineId;
  readonly cause: LineTripCause;
}

export interface LineCoolingPayload {
  readonly line: LineId;
}

export interface LineRecoveredPayload {
  readonly line: LineId;
}

export interface CascadeStartedPayload {
  readonly cascadeId: string;
  readonly originLine: LineId;
}

export interface CascadeStepPayload {
  readonly cascadeId: string;
  readonly step: number;
  readonly trippedLine: LineId;
}

export interface CascadeEndedPayload {
  readonly cascadeId: string;
  readonly totalSteps: number;
  readonly contained: boolean;
}

export interface ZonePoweredPayload {
  readonly zone: ZoneId;
}

export interface ZoneBlackoutPayload {
  readonly zone: ZoneId;
  readonly unservedLoad: MegaWatts;
}

export interface LoadShedAutomaticPayload {
  /** UFLS stage that fired, 1-based. */
  readonly stage: number;
  readonly thresholdHz: number;
  /** Fraction of system load this stage disconnected. */
  readonly shedFraction: number;
}

export interface SecurityChangedPayload {
  readonly verdict: 'Secure' | 'AtRisk' | 'Insecure';
  readonly reserveMw: MegaWatts;
  readonly largestInfeedMw: MegaWatts;
}

export interface DecisionRequestedPayload {
  readonly decisionId: DecisionId;
  readonly prompt: string;
  readonly options: readonly string[];
  /** Tick the prompt was raised at. The console counts down from here. */
  readonly requestedAtTick: number;
  /** How long the operator has to answer, in ticks. */
  readonly windowTicks: number;
  /**
   * The option that happens if nobody answers.
   *
   * Declared by the simulation rather than guessed by the console. Every
   * prompt today happens to put its passive option last, which is exactly the
   * kind of coincidence a UI would encode as `options.length - 1` and then be
   * silently wrong about the first time a prompt is reordered.
   */
  readonly defaultOptionIndex: number;
}

export interface DecisionCommittedPayload {
  readonly decisionId: DecisionId;
  readonly optionIndex: number;
  readonly simTime: Seconds;
}

/**
 * How a committed decision actually turned out, measured 30 simulated seconds
 * later against a snapshot taken at the moment it was committed.
 *
 * Deliberately separate from the evidence engine's 5-second reading. That one
 * answers "did the lever move the needle at all"; this one answers "and did it
 * hold" — which for a grid intervention is a different, later question.
 */
export interface DecisionConsequencePayload {
  readonly decisionId: DecisionId;
  readonly optionIndex: number;
  /** Tick at which the decision was committed. */
  readonly committedTick: number;
  /** Frequency deviation from nominal at commit, and now. Hz. */
  readonly deviationBeforeHz: number;
  readonly deviationAfterHz: number;
  /** Worst corridor loading at commit, and now. Per unit. */
  readonly loadingBefore: number;
  readonly loadingAfter: number;
  /** Districts dark at commit, and now. */
  readonly darkZonesBefore: number;
  readonly darkZonesAfter: number;
  /** Measured verdict. Derived only from the numbers above. */
  readonly verdict: 'improved' | 'held' | 'worsened';
  /** Operator-facing sentence quoting the measurement that decided it. */
  readonly summary: string;
}

export interface LearningUpdatedPayload {
  readonly conceptId: string;
  readonly mastery: Ratio;
}

export interface ReplayStartedPayload {
  readonly recordingId: string;
}

export interface ReplayFinishedPayload {
  readonly recordingId: string;
  readonly verified: boolean;
}

export interface GameEndedPayload {
  readonly outcome: GameOutcome;
  readonly score: number;
}

/**
 * The authoritative map from event name → payload type. Keys MUST match the
 * `GRID_EVENT` registry exactly; the `EventMapIntegrity` check below fails to
 * compile if the two ever drift.
 */
export interface GridEventMap extends KernelEventMap {
  WeatherChanged: WeatherChangedPayload;
  LoadChanged: LoadChangedPayload;
  GenerationChanged: GenerationChangedPayload;
  PowerFlowSolved: PowerFlowSolvedPayload;
  LineOverloaded: LineOverloadedPayload;
  LineTripStarted: LineTripStartedPayload;
  LineTripped: LineTrippedPayload;
  LineCooling: LineCoolingPayload;
  LineRecovered: LineRecoveredPayload;
  CascadeStarted: CascadeStartedPayload;
  CascadeStep: CascadeStepPayload;
  CascadeEnded: CascadeEndedPayload;
  ZonePowered: ZonePoweredPayload;
  ZoneBlackout: ZoneBlackoutPayload;
  LoadShedAutomatic: LoadShedAutomaticPayload;
  SecurityChanged: SecurityChangedPayload;
  DecisionRequested: DecisionRequestedPayload;
  DecisionCommitted: DecisionCommittedPayload;
  DecisionConsequence: DecisionConsequencePayload;
  LearningUpdated: LearningUpdatedPayload;
  ReplayStarted: ReplayStartedPayload;
  ReplayFinished: ReplayFinishedPayload;
  GameEnded: GameEndedPayload;
}

/** The concrete event bus type used throughout the simulation. */
export type GridEventBus = TypedEventBus<GridEventMap>;

/*
 * Compile-time guarantee that `GridEventMap` keys and the `GRID_EVENT`
 * registry are exactly the same set. If you add to one and forget the other,
 * this line errors.
 */
type Assert<T extends true> = T;
type MutuallyExtends<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type EventMapIntegrity = Assert<MutuallyExtends<keyof GridEventMap, GridEventName>>;
