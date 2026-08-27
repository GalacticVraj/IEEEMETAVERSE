import { describe, expect, it } from 'vitest';

import { voiceRateFor } from './voice-rate';

describe('voiceRateFor', () => {
  it('is deterministic — the same unit always sounds the same, so replays match', () => {
    expect(voiceRateFor('G-BASE-S')).toBe(voiceRateFor('G-BASE-S'));
  });

  it('gives different units different voices', () => {
    expect(voiceRateFor('G-BASE-S')).not.toBe(voiceRateFor('G-GAS-HB'));
  });

  it('stays inside a musical +/-8 %, so nothing sounds broken', () => {
    for (const id of [
      'G-BASE-S',
      'G-PEAK-S',
      'G-PEAK-IN',
      'G-SOLAR',
      'G-WIND',
      'G-BATT-DT',
      'G-IMPORT',
      'G-GAS-HB',
    ]) {
      const rate = voiceRateFor(id);
      expect(rate).toBeGreaterThanOrEqual(0.92);
      expect(rate).toBeLessThanOrEqual(1.08);
    }
  });

  it('leaves an unattributed cue at nominal pitch', () => {
    expect(voiceRateFor('')).toBe(1);
  });
});
