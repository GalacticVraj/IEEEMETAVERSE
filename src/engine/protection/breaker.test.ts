import { asLineId } from '@app-types';
import { describe, expect, it } from 'vitest';

import { DEFAULT_BREAKER_CONFIG } from './config';
import { BreakerPhase, createProtectionBreaker, stepBreaker } from './breaker';

const line = asLineId('l1');

describe('breaker', () => {
  it('begins opening on an open command', () => {
    const result = stepBreaker(
      createProtectionBreaker('bk1', line, DEFAULT_BREAKER_CONFIG),
      'open',
      0,
    );
    expect(result.breaker.phase).toBe(BreakerPhase.Opening);
    expect(result.events.some((e) => e.name === 'BreakerOpening')).toBe(true);
  });

  it('reaches Open after the operate time and signals the line is out', () => {
    let step = stepBreaker(createProtectionBreaker('bk1', line, DEFAULT_BREAKER_CONFIG), 'open', 0);
    step = stepBreaker(step.breaker, 'none', 1); // operateTicks = 1
    expect(step.breaker.phase).toBe(BreakerPhase.Open);
    expect(step.reachedOpen).toBe(true);
    expect(step.breaker.operationCount).toBe(1);
    expect(step.events.some((e) => e.name === 'BreakerOpened')).toBe(true);
  });

  it('closes on a close command', () => {
    const open = createProtectionBreaker('bk1', line, DEFAULT_BREAKER_CONFIG, BreakerPhase.Open);
    let step = stepBreaker(open, 'close', 5);
    expect(step.breaker.phase).toBe(BreakerPhase.Closing);
    step = stepBreaker(step.breaker, 'none', 6);
    expect(step.breaker.phase).toBe(BreakerPhase.Closed);
    expect(step.reachedClosed).toBe(true);
  });

  it('locks and then ignores further commands', () => {
    const locked = stepBreaker(
      createProtectionBreaker('bk1', line, DEFAULT_BREAKER_CONFIG),
      'lock',
      0,
    );
    expect(locked.breaker.phase).toBe(BreakerPhase.Locked);
    const ignored = stepBreaker(locked.breaker, 'open', 1);
    expect(ignored.breaker.phase).toBe(BreakerPhase.Locked);
  });

  it('is idempotent for redundant commands', () => {
    const closed = createProtectionBreaker('bk1', line, DEFAULT_BREAKER_CONFIG);
    expect(stepBreaker(closed, 'close', 0).breaker.phase).toBe(BreakerPhase.Closed);
  });

  it('is deterministic', () => {
    const a = createProtectionBreaker('bk1', line, DEFAULT_BREAKER_CONFIG);
    const b = createProtectionBreaker('bk1', line, DEFAULT_BREAKER_CONFIG);
    expect(stepBreaker(a, 'open', 0)).toEqual(stepBreaker(b, 'open', 0));
  });

  // --- Additional coverage: unreachable-in-happy-path states -----------------

  it('ignores all commands when in Maintenance state', () => {
    const maint = createProtectionBreaker(
      'bk1',
      line,
      DEFAULT_BREAKER_CONFIG,
      BreakerPhase.Maintenance,
    );
    const result = stepBreaker(maint, 'open', 0);
    expect(result.breaker.phase).toBe(BreakerPhase.Maintenance);
    expect(result.events).toHaveLength(0);
    expect(result.reachedOpen).toBe(false);
    expect(result.reachedClosed).toBe(false);
  });

  it('ignores all commands when in Faulted state', () => {
    const faulted = createProtectionBreaker(
      'bk1',
      line,
      DEFAULT_BREAKER_CONFIG,
      BreakerPhase.Faulted,
    );
    const result = stepBreaker(faulted, 'close', 0);
    expect(result.breaker.phase).toBe(BreakerPhase.Faulted);
    expect(result.events).toHaveLength(0);
    expect(result.reachedOpen).toBe(false);
    expect(result.reachedClosed).toBe(false);
  });

  it('stays in Closing while operate ticks have not elapsed', () => {
    const config = { ...DEFAULT_BREAKER_CONFIG, operateTicks: 3 };
    const open = createProtectionBreaker('bk1', line, config, BreakerPhase.Open);
    // Start closing at tick 10
    const step1 = stepBreaker(open, 'close', 10);
    expect(step1.breaker.phase).toBe(BreakerPhase.Closing);
    // elapsed at tick 11 = 1 < 3 → still Closing
    const step2 = stepBreaker(step1.breaker, 'none', 11);
    expect(step2.breaker.phase).toBe(BreakerPhase.Closing);
    expect(step2.reachedClosed).toBe(false);
    expect(step2.events.some((e) => e.name === 'BreakerClosing')).toBe(true);
  });

  it('stays in Opening while operate ticks have not elapsed', () => {
    const config = { ...DEFAULT_BREAKER_CONFIG, operateTicks: 3 };
    const closed = createProtectionBreaker('bk1', line, config);
    // Start opening at tick 10
    const step1 = stepBreaker(closed, 'open', 10);
    expect(step1.breaker.phase).toBe(BreakerPhase.Opening);
    // elapsed at tick 11 = 1 < 3 → still Opening
    const step2 = stepBreaker(step1.breaker, 'none', 11);
    expect(step2.breaker.phase).toBe(BreakerPhase.Opening);
    expect(step2.reachedOpen).toBe(false);
    expect(step2.events.some((e) => e.name === 'BreakerOpening')).toBe(true);
  });

  it('returns settled with no events for Open breaker given a none command', () => {
    const open = createProtectionBreaker('bk1', line, DEFAULT_BREAKER_CONFIG, BreakerPhase.Open);
    const result = stepBreaker(open, 'none', 5);
    expect(result.breaker.phase).toBe(BreakerPhase.Open);
    expect(result.events).toHaveLength(0);
    expect(result.reachedOpen).toBe(false);
    expect(result.reachedClosed).toBe(false);
  });

  it('hits the default branch for an unrecognised state gracefully', () => {
    // Simulate arriving at the default branch by casting to an unknown phase.
    const breaker = createProtectionBreaker('bk1', line, DEFAULT_BREAKER_CONFIG);
    // Manually construct a state with a phase value not in the switch.
    const unknown = { ...breaker, phase: 'UnknownPhase' as BreakerPhase };
    const result = stepBreaker(unknown, 'open', 0);
    // Should return settled (no mutation, no events).
    expect(result.events).toHaveLength(0);
    expect(result.reachedOpen).toBe(false);
    expect(result.reachedClosed).toBe(false);
  });
});
