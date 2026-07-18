import type { LineId } from '@app-types';

import type { RelayConfig } from './config';
import { getProtectionCurve } from './curves';

/** Explicit relay lifecycle states — no boolean flags. */
export const RelayPhase = {
  Idle: 'Idle',
  Monitoring: 'Monitoring',
  Pickup: 'Pickup',
  Timing: 'Timing',
  TripPending: 'TripPending',
  TripIssued: 'TripIssued',
  Resetting: 'Resetting',
  LockedOut: 'LockedOut',
  Disabled: 'Disabled',
} as const;
export type RelayPhase = (typeof RelayPhase)[keyof typeof RelayPhase];

export type RelayHealth = 'healthy' | 'degraded' | 'failed';

export type TripReason = 'instantaneous' | 'timed' | 'thermal';

/** Immutable relay state. The relay owns decisions; the breaker owns switching. */
export interface RelayState {
  readonly id: string;
  readonly line: LineId;
  readonly phase: RelayPhase;
  readonly config: RelayConfig;
  readonly lastPickupTick: number | null;
  readonly lastTripTick: number | null;
  readonly timingStartedTick: number | null;
  readonly resetStartedTick: number | null;
  readonly operationCount: number;
  readonly health: RelayHealth;
}

/** What the relay observes each tick (fed by power flow + thermal). */
export interface RelayObservation {
  readonly loading: number;
  readonly thermalCritical: boolean;
  readonly breakerClosed: boolean;
}

export interface RelayDecision {
  readonly trip: boolean;
  readonly reason: TripReason | null;
}

export interface RelayEvent {
  readonly name: string;
  readonly payload: unknown;
}

export interface RelayStepResult {
  readonly relay: RelayState;
  readonly decision: RelayDecision;
  readonly events: readonly RelayEvent[];
}

export function createRelay(id: string, line: LineId, config: RelayConfig): RelayState {
  return {
    id,
    line,
    phase: RelayPhase.Idle,
    config,
    lastPickupTick: null,
    lastTripTick: null,
    timingStartedTick: null,
    resetStartedTick: null,
    operationCount: 0,
    health: 'healthy',
  };
}

export function disableRelay(relay: RelayState): RelayState {
  return { ...relay, phase: RelayPhase.Disabled };
}

const NO_TRIP: RelayDecision = { trip: false, reason: null };

/**
 * Advance a relay one tick. Pure and deterministic: the same state + observation
 * + tick always produce the same next state, decision, and events. A `trip`
 * decision instructs the engine to command the breaker open.
 */
export function stepRelay(
  relay: RelayState,
  observation: RelayObservation,
  tick: number,
  timestepS: number,
): RelayStepResult {
  const { config } = relay;

  if (relay.phase === RelayPhase.Disabled) {
    return { relay, decision: NO_TRIP, events: [] };
  }
  if (relay.phase === RelayPhase.LockedOut) {
    return { relay, decision: NO_TRIP, events: [] };
  }
  if (relay.phase === RelayPhase.TripIssued) {
    return {
      relay: { ...relay, phase: RelayPhase.LockedOut },
      decision: NO_TRIP,
      events: [{ name: 'RelayLockedOut', payload: { relay: relay.id, line: relay.line, tick } }],
    };
  }

  const trip = (reason: TripReason): RelayStepResult => ({
    relay: {
      ...relay,
      phase: RelayPhase.TripIssued,
      lastTripTick: tick,
      operationCount: relay.operationCount + 1,
    },
    decision: { trip: true, reason },
    events: [
      { name: 'RelayTripIssued', payload: { relay: relay.id, line: relay.line, reason, tick } },
    ],
  });

  // A de-energized line (open breaker) has nothing to protect.
  if (!observation.breakerClosed) {
    return { relay: { ...relay, phase: RelayPhase.Monitoring }, decision: NO_TRIP, events: [] };
  }

  // Thermal and instantaneous trips fire from any active phase.
  if (observation.thermalCritical) return trip('thermal');
  if (config.instantaneousTrip && observation.loading >= config.instantaneousThreshold) {
    return trip('instantaneous');
  }

  const pickup = observation.loading >= config.pickupThreshold;
  const dropout = observation.loading < config.pickupThreshold * config.resetRatio;
  const requiredDelayS =
    getProtectionCurve(config.curve).tripDelayS(observation.loading, config) +
    (config.role === 'backup' ? config.coordinationDelayS : 0);

  const enterPickup = (): RelayStepResult => ({
    relay: { ...relay, phase: RelayPhase.Pickup, lastPickupTick: tick, timingStartedTick: tick },
    decision: NO_TRIP,
    events: [{ name: 'RelayPickup', payload: { relay: relay.id, line: relay.line, tick } }],
  });

  const evaluateTiming = (timingStartedTick: number, resumed: boolean): RelayStepResult => {
    const elapsedS = (tick - timingStartedTick) * timestepS;
    if (elapsedS >= requiredDelayS) return trip('timed');
    const events: RelayEvent[] = resumed
      ? [{ name: 'RelayTiming', payload: { relay: relay.id, line: relay.line, tick } }]
      : [];
    return {
      relay: { ...relay, phase: RelayPhase.Timing, timingStartedTick },
      decision: NO_TRIP,
      events,
    };
  };

  const enterResetting = (): RelayStepResult => ({
    relay: { ...relay, phase: RelayPhase.Resetting, resetStartedTick: tick },
    decision: NO_TRIP,
    events: [],
  });

  switch (relay.phase) {
    case RelayPhase.Idle:
    case RelayPhase.Monitoring: {
      if (pickup) return enterPickup();
      if (relay.phase === RelayPhase.Idle) {
        return {
          relay: { ...relay, phase: RelayPhase.Monitoring },
          decision: NO_TRIP,
          events: [
            { name: 'RelayMonitoring', payload: { relay: relay.id, line: relay.line, tick } },
          ],
        };
      }
      return { relay, decision: NO_TRIP, events: [] };
    }
    case RelayPhase.Pickup: {
      if (dropout) return enterResetting();
      return evaluateTiming(relay.timingStartedTick ?? tick, false);
    }
    case RelayPhase.Timing: {
      if (dropout) return enterResetting();
      return evaluateTiming(relay.timingStartedTick ?? tick, false);
    }
    case RelayPhase.Resetting: {
      if (pickup) return evaluateTiming(tick, true);
      const elapsedS = (tick - (relay.resetStartedTick ?? tick)) * timestepS;
      if (elapsedS >= config.resetDelayS) {
        return {
          relay: {
            ...relay,
            phase: RelayPhase.Monitoring,
            timingStartedTick: null,
            resetStartedTick: null,
          },
          decision: NO_TRIP,
          events: [{ name: 'RelayReset', payload: { relay: relay.id, line: relay.line, tick } }],
        };
      }
      return { relay, decision: NO_TRIP, events: [] };
    }
    default:
      return { relay, decision: NO_TRIP, events: [] };
  }
}
