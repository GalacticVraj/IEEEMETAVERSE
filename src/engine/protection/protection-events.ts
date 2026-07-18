import type { LineId } from '@app-types';
import type { KernelEventMap } from '@core';

import type { TripReason } from './relay';

/*
 * Protection events. `ProtectionEventMap` EXTENDS `KernelEventMap`; the engine
 * emits a deterministic sequence per evaluation. Relay/breaker/thermal payloads
 * mirror what the state machines produce.
 */

export interface RelayEventPayload {
  readonly relay: string;
  readonly line: LineId;
  readonly tick: number;
}

export interface RelayTripPayload {
  readonly relay: string;
  readonly line: LineId;
  readonly reason: TripReason;
  readonly tick: number;
}

export interface BreakerEventPayload {
  readonly breaker: string;
  readonly line: LineId;
  readonly tick: number;
}

export interface ThermalEventPayload {
  readonly line: LineId;
  readonly temperatureC: number;
  readonly tick: number;
}

export interface ProtectionDecisionPayload {
  readonly line: LineId;
  readonly relay: string;
  readonly trip: boolean;
  readonly reason: TripReason | null;
  readonly tick: number;
}

export interface ProtectionEvaluationCompletedPayload {
  readonly tick: number;
  readonly relaysEvaluated: number;
  readonly trips: number;
  readonly opened: number;
}

export interface ProtectionEventMap extends KernelEventMap {
  RelayMonitoring: RelayEventPayload;
  RelayPickup: RelayEventPayload;
  RelayTiming: RelayEventPayload;
  RelayReset: RelayEventPayload;
  RelayTripIssued: RelayTripPayload;
  RelayLockedOut: RelayEventPayload;
  BreakerOpening: BreakerEventPayload;
  BreakerOpened: BreakerEventPayload;
  BreakerClosing: BreakerEventPayload;
  BreakerClosed: BreakerEventPayload;
  BreakerLocked: BreakerEventPayload;
  ThermalRise: ThermalEventPayload;
  ThermalWarning: ThermalEventPayload;
  ThermalCritical: ThermalEventPayload;
  ProtectionDecision: ProtectionDecisionPayload;
  ProtectionEvaluationCompleted: ProtectionEvaluationCompletedPayload;
}

export const PROTECTION_EVENT = {
  RelayMonitoring: 'RelayMonitoring',
  RelayPickup: 'RelayPickup',
  RelayTiming: 'RelayTiming',
  RelayReset: 'RelayReset',
  RelayTripIssued: 'RelayTripIssued',
  RelayLockedOut: 'RelayLockedOut',
  BreakerOpening: 'BreakerOpening',
  BreakerOpened: 'BreakerOpened',
  BreakerClosing: 'BreakerClosing',
  BreakerClosed: 'BreakerClosed',
  BreakerLocked: 'BreakerLocked',
  ThermalRise: 'ThermalRise',
  ThermalWarning: 'ThermalWarning',
  ThermalCritical: 'ThermalCritical',
  ProtectionDecision: 'ProtectionDecision',
  ProtectionEvaluationCompleted: 'ProtectionEvaluationCompleted',
} as const;

export type ProtectionEventName = (typeof PROTECTION_EVENT)[keyof typeof PROTECTION_EVENT];
