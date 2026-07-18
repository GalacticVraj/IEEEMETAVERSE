import { asLineId } from '@app-types';
import { describe, expect, it } from 'vitest';

import { DEFAULT_RELAY_CONFIG, ProtectionCurveType } from './config';
import type { RelayConfig } from './config';
import { RelayPhase, createRelay, disableRelay, stepRelay } from './relay';
import type { RelayObservation, RelayState } from './relay';

const line = asLineId('l1');
const cfg = (over: Partial<RelayConfig> = {}): RelayConfig => ({
  ...DEFAULT_RELAY_CONFIG,
  ...over,
});
const obs = (loading: number, over: Partial<RelayObservation> = {}): RelayObservation => ({
  loading,
  thermalCritical: false,
  breakerClosed: true,
  ...over,
});

/** Drive a relay across ticks with a constant observation. */
const drive = (relay: RelayState, observation: RelayObservation, ticks: number, timestepS = 1) => {
  let current = relay;
  const results = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    const result = stepRelay(current, observation, tick, timestepS);
    current = result.relay;
    results.push(result);
  }
  return { relay: current, results };
};

describe('relay', () => {
  it('picks up when loading reaches the pickup threshold', () => {
    const result = stepRelay(createRelay('r1', line, cfg()), obs(1.2), 0, 1);
    expect(result.relay.phase).toBe(RelayPhase.Pickup);
    expect(result.decision.trip).toBe(false);
    expect(result.events.some((e) => e.name === 'RelayPickup')).toBe(true);
  });

  it('stays monitoring below pickup', () => {
    const result = stepRelay(createRelay('r1', line, cfg()), obs(0.5), 0, 1);
    expect(result.relay.phase).toBe(RelayPhase.Monitoring);
    expect(result.decision.trip).toBe(false);
  });

  it('trips instantaneously above the instantaneous threshold', () => {
    const result = stepRelay(createRelay('r1', line, cfg()), obs(2), 0, 1);
    expect(result.relay.phase).toBe(RelayPhase.TripIssued);
    expect(result.decision.trip).toBe(true);
    expect(result.decision.reason).toBe('instantaneous');
    expect(result.relay.operationCount).toBe(1);
  });

  it('trips after the definite-time delay', () => {
    const relay = createRelay(
      'r1',
      line,
      cfg({ curve: ProtectionCurveType.DefiniteTime, instantaneousTrip: false }),
    );
    const { results } = drive(relay, obs(1.2), 4);
    // tripDelayS = 2s at 1s/tick ⇒ trips once elapsed ≥ 2.
    const tripTick = results.findIndex((r) => r.decision.trip);
    expect(tripTick).toBe(2);
  });

  it('resets when the overload clears', () => {
    let relay = stepRelay(createRelay('r1', line, cfg()), obs(1.2), 0, 1).relay;
    relay = stepRelay(relay, obs(0.5), 1, 1).relay; // drops out → Resetting
    const settled = stepRelay(relay, obs(0.5), 2, 1); // reset delay 1s elapsed
    expect(settled.relay.phase).toBe(RelayPhase.Monitoring);
    expect(settled.relay.operationCount).toBe(0);
  });

  it('trips on a thermal-critical condition even below pickup', () => {
    const result = stepRelay(
      createRelay('r1', line, cfg()),
      obs(0.8, { thermalCritical: true }),
      0,
      1,
    );
    expect(result.decision.trip).toBe(true);
    expect(result.decision.reason).toBe('thermal');
  });

  it('locks out after a trip and stays locked', () => {
    let relay = stepRelay(createRelay('r1', line, cfg()), obs(2), 0, 1).relay; // TripIssued
    relay = stepRelay(relay, obs(2), 1, 1).relay; // → LockedOut
    expect(relay.phase).toBe(RelayPhase.LockedOut);
    const again = stepRelay(relay, obs(2), 2, 1);
    expect(again.relay.phase).toBe(RelayPhase.LockedOut);
    expect(again.decision.trip).toBe(false);
  });

  it('does nothing when disabled', () => {
    const disabled = disableRelay(createRelay('r1', line, cfg()));
    const result = stepRelay(disabled, obs(2), 0, 1);
    expect(result.relay.phase).toBe(RelayPhase.Disabled);
    expect(result.decision.trip).toBe(false);
  });

  it('is deterministic', () => {
    const a = createRelay('r1', line, cfg());
    const b = createRelay('r1', line, cfg());
    expect(stepRelay(a, obs(1.3), 0, 1)).toEqual(stepRelay(b, obs(1.3), 0, 1));
  });

  // --- Additional coverage for uncovered branches ---------------------------

  it('does not trip while in Timing phase if loading drops below pickup (enters Resetting)', () => {
    const relay = createRelay(
      'r1',
      line,
      cfg({ curve: ProtectionCurveType.DefiniteTime, instantaneousTrip: false, tripDelayS: 10 }),
    );
    // Tick 0: pickup
    let r = stepRelay(relay, obs(1.2), 0, 1).relay;
    expect(r.phase).toBe(RelayPhase.Pickup);
    // Tick 1: still above pickup, enters Timing
    r = stepRelay(r, obs(1.2), 1, 1).relay;
    expect(r.phase).toBe(RelayPhase.Timing);
    // Tick 2: loading drops out → Resetting (no trip)
    const result = stepRelay(r, obs(0.5), 2, 1);
    expect(result.relay.phase).toBe(RelayPhase.Resetting);
    expect(result.decision.trip).toBe(false);
  });

  it('stays in Resetting while reset delay has not elapsed', () => {
    const config = cfg({ resetDelayS: 5, instantaneousTrip: false });
    // Get into Resetting
    let r = stepRelay(createRelay('r1', line, config), obs(1.2), 0, 1).relay; // Pickup
    r = stepRelay(r, obs(0.5), 1, 1).relay; // dropout → Resetting
    expect(r.phase).toBe(RelayPhase.Resetting);
    // Only 1 tick elapsed (1s), but resetDelayS = 5s → still Resetting
    const result = stepRelay(r, obs(0.5), 2, 1);
    expect(result.relay.phase).toBe(RelayPhase.Resetting);
    expect(result.decision.trip).toBe(false);
    expect(result.events).toHaveLength(0);
  });

  it('from Resetting, re-pickup restarts timing and emits RelayTiming', () => {
    const config = cfg({
      curve: ProtectionCurveType.DefiniteTime,
      instantaneousTrip: false,
      tripDelayS: 10,
      resetDelayS: 5,
    });
    // Get into Resetting state
    let r = stepRelay(createRelay('r1', line, config), obs(1.2), 0, 1).relay; // Pickup
    r = stepRelay(r, obs(0.5), 1, 1).relay; // dropout → Resetting
    expect(r.phase).toBe(RelayPhase.Resetting);
    // Now loading rises again above pickup → evaluateTiming(tick, resumed=true) emits RelayTiming
    const result = stepRelay(r, obs(1.2), 2, 1);
    expect(result.relay.phase).toBe(RelayPhase.Timing);
    expect(result.events.some((e) => e.name === 'RelayTiming')).toBe(true);
  });

  it('stays in Monitoring when below pickup (no transition events after first)', () => {
    // Second tick in Monitoring should produce no events and keep phase
    const r = stepRelay(createRelay('r1', line, cfg()), obs(0.5), 0, 1).relay;
    expect(r.phase).toBe(RelayPhase.Monitoring);
    const result = stepRelay(r, obs(0.5), 1, 1);
    expect(result.relay.phase).toBe(RelayPhase.Monitoring);
    expect(result.events).toHaveLength(0);
    expect(result.decision.trip).toBe(false);
  });

  it('returns no-trip when breaker is open (open line)', () => {
    const result = stepRelay(
      createRelay('r1', line, cfg()),
      obs(2.0, { breakerClosed: false }),
      0,
      1,
    );
    // No protection needed for an already open line
    expect(result.decision.trip).toBe(false);
    expect(result.relay.phase).toBe(RelayPhase.Monitoring);
  });

  it('hits default branch for unknown relay phase gracefully', () => {
    const relay = createRelay('r1', line, cfg());
    // Inject an unknown phase not in the switch statement
    const unknown = { ...relay, phase: 'TripPending' as RelayPhase };
    const result = stepRelay(unknown, obs(1.2), 0, 1);
    // Should return no-trip (default branch)
    expect(result.decision.trip).toBe(false);
  });
});
