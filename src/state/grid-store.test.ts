import { describe, expect, it } from 'vitest';

import { useGridStore } from './grid-store';

describe('grid-store projection', () => {
  it('defaults to a 60 Hz grid at rest', () => {
    const state = useGridStore.getState();
    // This is a 60 Hz interconnection. The projection previously seeded 50,
    // so the console flashed a European nominal before the first tick landed.
    expect(state.frequency).toBe(60);
    expect(state.rocof).toBe(0);
    expect(state.inertiaMwS).toBe(0);
    expect(state.uflsStage).toBe(0);
    expect(state.uflsShedFraction).toBe(0);
    expect(state.security).toBe('Secure');
    expect(state.reserveMw).toBe(0);
    expect(state.largestInfeedMw).toBe(0);
  });
});

describe('grid-store projects EVERY field the console reads', () => {
  it('copies the whole GridState scalar set on a tick', async () => {
    // Regression guard. The projection silently dropped rocof/inertia/security
    // /reserve, so the console reported "0 MW·s" and "0 MW reserve" for a
    // whole run while the engine had the real numbers all along. A missing
    // line here is invisible at runtime — nothing throws, the panel just lies.
    const { createEventBus } = await import('@core');
    const { GRID_EVENT } = await import('@constants');
    const { bindGridStore } = await import('./grid-store');

    const bus = createEventBus<never>();
    const state = {
      frequency: 59.4,
      rocof: -0.82,
      inertiaMwS: 4040,
      uflsStage: 2,
      uflsShedFraction: 0.15,
      security: 'Insecure' as const,
      reserveMw: 137,
      largestInfeedMw: 400,
      totalGeneration: 950,
      totalLoad: 1010,
      renewableGeneration: 120,
      lines: [],
      zones: [],
      generators: [],
    };
    const engine = { getState: () => state } as never;

    const unbind = bindGridStore(bus as never, engine);
    (bus as never as { emit(n: string, p: unknown): void }).emit(GRID_EVENT.SimulationTick, {
      tick: 7,
    });

    const projected = useGridStore.getState();
    expect(projected.frequency).toBe(59.4);
    expect(projected.rocof).toBe(-0.82);
    expect(projected.inertiaMwS).toBe(4040);
    expect(projected.uflsStage).toBe(2);
    expect(projected.uflsShedFraction).toBeCloseTo(0.15, 6);
    expect(projected.security).toBe('Insecure');
    expect(projected.reserveMw).toBe(137);
    expect(projected.largestInfeedMw).toBe(400);
    unbind();
  });
});
