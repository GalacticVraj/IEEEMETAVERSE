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
});
