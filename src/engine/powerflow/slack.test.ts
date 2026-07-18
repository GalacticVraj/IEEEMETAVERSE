import { asBusId } from '@app-types';
import type { BusId } from '@app-types';
import { describe, expect, it } from 'vitest';

import { selectSlack } from './slack';

const buses = (...ids: string[]): BusId[] => ids.map(asBusId);
const caps = (entries: Record<string, number>): Map<BusId, number> =>
  new Map(Object.entries(entries).map(([id, mw]) => [asBusId(id), mw]));

describe('selectSlack', () => {
  it('uses a configured slack when it is in the island', () => {
    const result = selectSlack(buses('b1', 'b2'), caps({ b1: 100 }), asBusId('b2'));
    expect(result.bus).toBe(asBusId('b2'));
    expect(result.reason).toBe('configured');
  });

  it('ignores a configured slack that is not in the island', () => {
    const result = selectSlack(buses('b1', 'b2'), caps({ b1: 100 }), asBusId('elsewhere'));
    expect(result.bus).toBe(asBusId('b1'));
    expect(result.reason).toBe('generator-priority');
  });

  it('picks the largest generator by capacity', () => {
    const result = selectSlack(buses('b1', 'b2', 'b3'), caps({ b1: 50, b2: 300, b3: 100 }));
    expect(result.bus).toBe(asBusId('b2'));
    expect(result.reason).toBe('generator-priority');
  });

  it('breaks capacity ties by smallest bus id', () => {
    const result = selectSlack(buses('b3', 'b1', 'b2'), caps({ b1: 100, b3: 100 }));
    expect(result.bus).toBe(asBusId('b1'));
  });

  it('falls back to the smallest bus id when there is no generator', () => {
    const result = selectSlack(buses('b3', 'b1', 'b2'), caps({}));
    expect(result.bus).toBe(asBusId('b1'));
    expect(result.reason).toBe('fallback');
  });
});
