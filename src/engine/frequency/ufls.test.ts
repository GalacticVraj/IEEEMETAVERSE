import { describe, expect, it } from 'vitest';

import { INITIAL_UFLS_STATE, stepUfls, totalShedFraction } from './ufls';

describe('stepUfls', () => {
  it('sheds nothing at nominal frequency', () => {
    const result = stepUfls(INITIAL_UFLS_STATE, 60);
    expect(result.newlyTripped).toEqual([]);
    expect(totalShedFraction(result.state)).toBe(0);
  });

  it('sheds nothing just above the first threshold', () => {
    const result = stepUfls(INITIAL_UFLS_STATE, 59.31);
    expect(result.newlyTripped).toEqual([]);
  });

  it('fires stage 1 at 59.3 Hz', () => {
    const result = stepUfls(INITIAL_UFLS_STATE, 59.3);
    expect(result.newlyTripped).toEqual([1]);
    expect(totalShedFraction(result.state)).toBeCloseTo(0.05, 6);
  });

  it('fires every crossed stage when frequency plunges past several at once', () => {
    const result = stepUfls(INITIAL_UFLS_STATE, 58.5);
    expect(result.newlyTripped).toEqual([1, 2, 3]);
    expect(totalShedFraction(result.state)).toBeCloseTo(0.25, 6);
  });

  it('latches — a recovered frequency does not restore shed load', () => {
    const tripped = stepUfls(INITIAL_UFLS_STATE, 59.0).state;
    const recovered = stepUfls(tripped, 60.0);
    expect(recovered.newlyTripped).toEqual([]);
    expect(totalShedFraction(recovered.state)).toBeCloseTo(0.15, 6);
  });

  it('never fires the same stage twice', () => {
    const first = stepUfls(INITIAL_UFLS_STATE, 59.3);
    const second = stepUfls(first.state, 59.3);
    expect(second.newlyTripped).toEqual([]);
    expect(totalShedFraction(second.state)).toBeCloseTo(0.05, 6);
  });

  it('escalates stage by stage as frequency keeps falling', () => {
    let state = INITIAL_UFLS_STATE;
    state = stepUfls(state, 59.3).state;
    expect(totalShedFraction(state)).toBeCloseTo(0.05, 6);
    state = stepUfls(state, 59.0).state;
    expect(totalShedFraction(state)).toBeCloseTo(0.15, 6);
    state = stepUfls(state, 58.7).state;
    expect(totalShedFraction(state)).toBeCloseTo(0.25, 6);
  });
});
