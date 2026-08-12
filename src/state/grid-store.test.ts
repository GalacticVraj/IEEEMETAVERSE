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
