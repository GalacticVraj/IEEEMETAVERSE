import { asHertz, asMegaWatts, asPerUnit } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createEventBus } from '@core';
import { describe, expect, it, vi } from 'vitest';

import type { GridState } from '../model/grid';
import { GridDirector } from './director';

describe('GridDirector', () => {
  const makeMockContext = () => {
    const events = createEventBus<any>();
    const emitSpy = vi.spyOn(events, 'emit');
    return {
      events,
      rng: {} as any,
      clock: { tick: 1 } as any,
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
    lines: [
      {
        line: 'l1' as any,
        flow: asMegaWatts(50),
        loading: asPerUnit(maxLoading),
        state: hasCascade ? 'Tripped' : 'Nominal',
      },
    ],
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
    let dir = director.pace(ctx, makeMockState(0.5));
    expect(dir.severity).toBe('Info');

    // Caution
    dir = director.pace(ctx, makeMockState(0.8));
    expect(dir.severity).toBe('Caution');

    // Warning
    dir = director.pace(ctx, makeMockState(0.95));
    expect(dir.severity).toBe('Warning');

    // Critical
    dir = director.pace(ctx, makeMockState(1.15));
    expect(dir.severity).toBe('Critical');
  });

  it('performs hysteresis smoothing on severity drops', () => {
    const director = new GridDirector();
    const ctx = makeMockContext();
    director.init(ctx);

    // Set to Critical
    director.pace(ctx, makeMockState(1.2));
    expect(director.pace(ctx, makeMockState(1.2)).severity).toBe('Critical');

    // Drop to Info immediately: hysteresis should maintain Critical for 2 more ticks
    expect(director.pace(ctx, makeMockState(0.5)).severity).toBe('Critical');
    expect(director.pace(ctx, makeMockState(0.5)).severity).toBe('Critical');

    // 3rd tick after drop: should finally drop to Info
    expect(director.pace(ctx, makeMockState(0.5)).severity).toBe('Info');
  });

  it('triggers decisions on overload, cascade and blackout', () => {
    const director = new GridDirector();
    const ctx = makeMockContext();
    director.init(ctx);

    // Overload trigger
    director.pace(ctx, makeMockState(1.05));
    expect(ctx.emitSpy).toHaveBeenCalledWith(GRID_EVENT.DecisionRequested, expect.objectContaining({
      prompt: expect.stringContaining('High line loading detected'),
    }));

    // Cascade trigger
    ctx.emitSpy.mockClear();
    director.pace(ctx, makeMockState(0.5, true));
    expect(ctx.emitSpy).toHaveBeenCalledWith(GRID_EVENT.DecisionRequested, expect.objectContaining({
      prompt: expect.stringContaining('Cascading failure sequence detected'),
    }));

    // Blackout trigger
    ctx.emitSpy.mockClear();
    director.pace(ctx, makeMockState(0.5, false, true));
    expect(ctx.emitSpy).toHaveBeenCalledWith(GRID_EVENT.DecisionRequested, expect.objectContaining({
      prompt: expect.stringContaining('Blackout detected'),
    }));
  });
});
