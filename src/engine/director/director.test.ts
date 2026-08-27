import { asHertz, asMegaWatts, asPerUnit } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createEventBus } from '@core';
import { describe, expect, it, vi } from 'vitest';

import type { GridState } from '../model/grid';
import { GridDirector } from './director';

describe('GridDirector', () => {
  /**
   * @param rolls Successive values `rng.next()` will return. The director rolls
   * against a stress-scaled risk, so a test controls the outcome by supplying
   * a value it knows falls above or below that threshold. Real runs use the
   * kernel's seeded xoroshiro stream — never `Math.random`.
   */
  const makeMockContext = (rolls: number[] = [0.99]) => {
    const events = createEventBus<any>();
    const emitSpy = vi.spyOn(events, 'emit');
    let rollIndex = 0;
    const clock = { tick: 1 } as { tick: number };
    return {
      events,
      rng: {
        next: () => rolls[Math.min(rollIndex++, rolls.length - 1)] ?? 0.99,
      } as any,
      clock: clock as any,
      _clock: clock,
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

  const makeMockState = (maxLoading = 0.5, hasCascade = false, hasBlackout = false): GridState => ({
    frequency: asHertz(60),
    rocof: 0,
    inertiaMwS: 3760,
    uflsStage: 0,
    uflsShedFraction: 0,
    security: 'Secure',
    reserveMw: 0 as never,
    largestInfeedMw: 0 as never,
    lines: [
      {
        line: 'l1' as any,
        flow: asMegaWatts(50),
        loading: asPerUnit(maxLoading),
        state: hasCascade ? 'Tripped' : 'Nominal',
      },
    ],
    restoration: [],
    zones: [
      {
        zone: 'Z1' as any,
        state: hasBlackout ? 'Blackout' : 'Powered',
        servedLoad: asMegaWatts(50),
        unservedLoad: asMegaWatts(0),
      },
    ],
    totalGeneration: asMegaWatts(50),
    totalLoad: asMegaWatts(50),
    renewableGeneration: asMegaWatts(0),
    generators: [],
  });

  it('determines normal/warning/critical severity', () => {
    const director = new GridDirector();
    const ctx = makeMockContext();
    director.init(ctx);

    // Nominally normal
    let dir = director.pace({ tick: 1 }, makeMockState(0.5));
    expect(dir.severity).toBe('Info');

    // Caution
    dir = director.pace({ tick: 1 }, makeMockState(0.8));
    expect(dir.severity).toBe('Caution');

    // Warning
    dir = director.pace({ tick: 1 }, makeMockState(0.95));
    expect(dir.severity).toBe('Warning');

    // Critical
    dir = director.pace({ tick: 1 }, makeMockState(1.15));
    expect(dir.severity).toBe('Critical');
  });

  it('performs hysteresis smoothing on severity drops', () => {
    const director = new GridDirector();
    const ctx = makeMockContext();
    director.init(ctx);

    // Set to Critical
    director.pace({ tick: 1 }, makeMockState(1.2));
    expect(director.pace({ tick: 1 }, makeMockState(1.2)).severity).toBe('Critical');

    // Drop to Info immediately: hysteresis should maintain Critical for 2 more ticks
    expect(director.pace({ tick: 1 }, makeMockState(0.5)).severity).toBe('Critical');
    expect(director.pace({ tick: 1 }, makeMockState(0.5)).severity).toBe('Critical');

    // 3rd tick after drop: should finally drop to Info
    expect(director.pace({ tick: 1 }, makeMockState(0.5)).severity).toBe('Info');
  });

  it('triggers decisions on overload, cascade and blackout', () => {
    const director = new GridDirector();
    const ctx = makeMockContext();
    director.init(ctx);

    // Overload trigger
    director.pace({ tick: 1 }, makeMockState(1.05));
    expect(ctx.emitSpy).toHaveBeenCalledWith(
      GRID_EVENT.DecisionRequested,
      expect.objectContaining({
        prompt: expect.stringContaining('High line loading detected'),
      }),
    );

    // Cascade trigger
    ctx.emitSpy.mockClear();
    director.pace({ tick: 1 }, makeMockState(0.5, true));
    expect(ctx.emitSpy).toHaveBeenCalledWith(
      GRID_EVENT.DecisionRequested,
      expect.objectContaining({
        prompt: expect.stringContaining('Cascading failure sequence detected'),
      }),
    );

    // Blackout trigger
    ctx.emitSpy.mockClear();
    director.pace({ tick: 1 }, makeMockState(0.5, false, true));
    expect(ctx.emitSpy).toHaveBeenCalledWith(
      GRID_EVENT.DecisionRequested,
      expect.objectContaining({
        prompt: expect.stringContaining('Blackout detected'),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Decision branching & measured consequences
  // -------------------------------------------------------------------------

  /** Commit a decision on the bus the way the console does. */
  const commit = (ctx: ReturnType<typeof makeMockContext>, id: string, optionIndex: number) => {
    ctx.events.emit(GRID_EVENT.DecisionCommitted, {
      decisionId: id,
      optionIndex,
      simTime: 0,
    });
  };

  it('rolls on the SEEDED stream, never Math.random', () => {
    // If the director ever reached for Math.random a replay would diverge from
    // its own recording. Supplying the roll proves the injected stream is the
    // one being consumed.
    const director = new GridDirector();
    const ctx = makeMockContext([0.0]);
    const nextSpy = vi.spyOn(ctx.rng, 'next');
    director.init(ctx);
    director.pace({ tick: 1 }, makeMockState(0.9));
    commit(ctx, 'dec-overload-10', 3); // the "do nothing" option

    expect(nextSpy).toHaveBeenCalled();
  });

  it('scales the risk of holding by measured stress, not a flat coin', () => {
    // 0.5 is above the calm-grid risk (~0.15) and below the stressed-grid risk
    // (~0.7). The SAME roll must therefore be survivable on a quiet grid and
    // costly on a loaded one — which is the whole point of scaling it.
    const calm = new GridDirector();
    const calmCtx = makeMockContext([0.5]);
    calm.init(calmCtx);
    calm.pace({ tick: 1 }, makeMockState(0.1));
    commit(calmCtx, 'dec-overload-10', 3);
    calm.pace({ tick: 1 }, makeMockState(0.1, true));
    expect(calmCtx.emitSpy).toHaveBeenCalledWith(
      GRID_EVENT.DecisionRequested,
      expect.objectContaining({ prompt: expect.stringContaining('Cascading failure sequence') }),
    );

    const loaded = new GridDirector();
    const loadedCtx = makeMockContext([0.5]);
    loaded.init(loadedCtx);
    loaded.pace({ tick: 1 }, makeMockState(0.99));
    commit(loadedCtx, 'dec-overload-10', 3);
    loaded.pace({ tick: 1 }, makeMockState(0.99, true));
    expect(loadedCtx.emitSpy).toHaveBeenCalledWith(
      GRID_EVENT.DecisionRequested,
      expect.objectContaining({
        prompt: expect.stringContaining('margin you were holding is gone'),
      }),
    );
  });

  it('does not branch when the operator actually intervened', () => {
    const director = new GridDirector();
    const ctx = makeMockContext([0.0]); // a roll that would always cost
    director.init(ctx);
    director.pace({ tick: 1 }, makeMockState(0.99));
    commit(ctx, 'dec-overload-10', 0); // an ACTIVE option
    director.pace({ tick: 1 }, makeMockState(0.99, true));

    expect(ctx.emitSpy).toHaveBeenCalledWith(
      GRID_EVENT.DecisionRequested,
      expect.objectContaining({ prompt: expect.stringContaining('Cascading failure sequence') }),
    );
  });

  it('reports a measured consequence after the settling window, not before', () => {
    const director = new GridDirector();
    const ctx = makeMockContext();
    director.init(ctx);

    ctx._clock.tick = 100;
    director.pace({ tick: 100 }, makeMockState(0.9));
    commit(ctx, 'dec-overload-100', 0);

    // Well inside the window: nothing yet.
    director.pace({ tick: 200 }, makeMockState(0.9));
    expect(ctx.emitSpy).not.toHaveBeenCalledWith(GRID_EVENT.DecisionConsequence, expect.anything());

    // Past 300 ticks with the corridor eased right off.
    director.pace({ tick: 401 }, makeMockState(0.4));
    expect(ctx.emitSpy).toHaveBeenCalledWith(
      GRID_EVENT.DecisionConsequence,
      expect.objectContaining({ verdict: 'improved', committedTick: 100 }),
    );
  });

  it('calls a consequence worsened when the corridor climbed', () => {
    const director = new GridDirector();
    const ctx = makeMockContext();
    director.init(ctx);

    ctx._clock.tick = 50;
    director.pace({ tick: 50 }, makeMockState(0.5));
    commit(ctx, 'dec-overload-50', 0);
    director.pace({ tick: 400 }, makeMockState(0.95));

    expect(ctx.emitSpy).toHaveBeenCalledWith(
      GRID_EVENT.DecisionConsequence,
      expect.objectContaining({ verdict: 'worsened' }),
    );
  });

  it('treats a district going dark as outranking every other measurement', () => {
    const director = new GridDirector();
    const ctx = makeMockContext();
    director.init(ctx);

    ctx._clock.tick = 50;
    director.pace({ tick: 50 }, makeMockState(0.99));
    commit(ctx, 'dec-overload-50', 0);
    // Corridor eased — which alone would read "improved" — but a district went
    // dark, and that is the thing that actually happened to the city.
    director.pace({ tick: 400 }, makeMockState(0.3, false, true));

    expect(ctx.emitSpy).toHaveBeenCalledWith(
      GRID_EVENT.DecisionConsequence,
      expect.objectContaining({ verdict: 'worsened', darkZonesAfter: 1 }),
    );
  });

  it('quotes the numbers that decided the verdict', () => {
    const director = new GridDirector();
    const ctx = makeMockContext();
    director.init(ctx);

    ctx._clock.tick = 50;
    director.pace({ tick: 50 }, makeMockState(0.9));
    commit(ctx, 'dec-overload-50', 0);
    director.pace({ tick: 400 }, makeMockState(0.4));

    const call = ctx.emitSpy.mock.calls.find(([name]) => name === GRID_EVENT.DecisionConsequence);
    expect(call?.[1].summary).toMatch(/90 %|40 %/);
  });

  it('clears pending decisions on reset so a restart inherits nothing', () => {
    const director = new GridDirector();
    const ctx = makeMockContext();
    director.init(ctx);

    ctx._clock.tick = 50;
    director.pace({ tick: 50 }, makeMockState(0.9));
    commit(ctx, 'dec-overload-50', 0);
    director.reset();
    ctx.emitSpy.mockClear();
    director.pace({ tick: 400 }, makeMockState(0.4));

    expect(ctx.emitSpy).not.toHaveBeenCalledWith(GRID_EVENT.DecisionConsequence, expect.anything());
  });
});
