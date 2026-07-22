import { asLineId } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createEventBus } from '@core';
import { describe, expect, it, vi } from 'vitest';

import { DeterministicCascadeEngine } from './cascade';

describe('DeterministicCascadeEngine', () => {
  const makeMockContext = (tick = 0) => {
    const events = createEventBus<any>();
    const emitSpy = vi.spyOn(events, 'emit');
    return {
      events,
      rng: {} as any,
      clock: { tick } as any,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        child: () => (this as any).logger,
      } as any,
      emitSpy,
    };
  };

  it('remains inactive when there are no trips', () => {
    const model = new DeterministicCascadeEngine();
    const ctx = makeMockContext(1);
    model.init(ctx);

    const state = model.propagate([]);
    expect(state.active).toBe(false);
    expect(state.step).toBe(0);
    expect(ctx.emitSpy).not.toHaveBeenCalled();
  });

  it('starts cascade on overload trip', () => {
    const model = new DeterministicCascadeEngine();
    const ctx = makeMockContext(1);
    model.init(ctx);

    // Simulate trip event emitted by protection
    ctx.events.emit(GRID_EVENT.LineTripped, { line: asLineId('L1'), cause: 'Overload' });

    const state = model.propagate([]);
    expect(state.active).toBe(true);
    expect(state.step).toBe(1);
    expect(state.trippedLines).toEqual([asLineId('L1')]);
    expect(ctx.emitSpy).toHaveBeenCalledWith(GRID_EVENT.CascadeStarted, {
      cascadeId: 'cascade-1',
      originLine: asLineId('L1'),
    });
  });

  it('steps and then ends cascade when contained', () => {
    const model = new DeterministicCascadeEngine();
    let tick = 1;
    const ctx = makeMockContext(tick);
    model.init(ctx);

    // Tick 1: L1 trips (starts cascade)
    ctx.events.emit(GRID_EVENT.LineTripped, { line: asLineId('L1'), cause: 'Overload' });
    model.propagate([]);
    expect(model.isActive()).toBe(true);

    // Tick 2: L2 trips (step 2)
    ctx.clock.tick = 2;
    ctx.events.emit(GRID_EVENT.LineTripped, { line: asLineId('L2'), cause: 'Overload' });
    model.propagate([]);
    expect(model.isActive()).toBe(true);
    expect(ctx.emitSpy).toHaveBeenCalledWith(GRID_EVENT.CascadeStep, {
      cascadeId: 'cascade-1',
      step: 2,
      trippedLine: asLineId('L2'),
    });

    // Tick 3: No trips (ends cascade)
    ctx.clock.tick = 3;
    const finalState = model.propagate([]);
    expect(finalState.active).toBe(false);
    expect(finalState.step).toBe(2);
    expect(ctx.emitSpy).toHaveBeenCalledWith(GRID_EVENT.CascadeEnded, {
      cascadeId: 'cascade-1',
      totalSteps: 2,
      contained: true,
    });
  });

  it('terminates cascade when reaching max depth 10', () => {
    const model = new DeterministicCascadeEngine();
    const ctx = makeMockContext(1);
    model.init(ctx);

    // Tick 1: L1 trips (starts cascade)
    ctx.events.emit(GRID_EVENT.LineTripped, { line: asLineId('L1'), cause: 'Overload' });
    model.propagate([]);

    // Step 2 to 10
    for (let i = 2; i <= 10; i++) {
      ctx.clock.tick = i;
      ctx.events.emit(GRID_EVENT.LineTripped, { line: asLineId(`L${i}`), cause: 'Overload' });
      model.propagate([]);
    }

    expect(model.isActive()).toBe(false);
    expect(ctx.emitSpy).toHaveBeenCalledWith(GRID_EVENT.CascadeEnded, {
      cascadeId: 'cascade-1',
      totalSteps: 10,
      contained: false,
    });
  });

  it('snapshots and restores cascade state', () => {
    const model = new DeterministicCascadeEngine();
    const ctx = makeMockContext(1);
    model.init(ctx);

    ctx.events.emit(GRID_EVENT.LineTripped, { line: asLineId('L1'), cause: 'Overload' });
    model.propagate([]);

    const snap = model.captureState();
    model.reset();
    expect(model.isActive()).toBe(false);

    model.restoreState(snap);
    expect(model.isActive()).toBe(true);
  });
});
