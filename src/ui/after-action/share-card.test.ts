import { describe, expect, it } from 'vitest';

import { shareText } from './share-card';
import type { ShareCardData } from './share-card';

const RUN: ShareCardData = {
  operatorName: 'V. Shah',
  rank: 'Senior Operator',
  scenarioName: 'Record Heatwave',
  score: 87,
  outcome: 'Held',
  districtsHeld: 6,
  districtsTotal: 6,
  worstFrequencyDeviationHz: 0.31,
  peakCorridorStress: 0.94,
  unservedMwS: 0,
};

describe('shareText', () => {
  it('states the score, the scenario and the rank', () => {
    const text = shareText(RUN);
    expect(text).toContain('87/100');
    expect(text).toContain('Record Heatwave');
    expect(text).toContain('Senior Operator');
  });

  it('quotes districts held — the figure the run is actually about', () => {
    expect(shareText(RUN)).toContain('6/6 districts');
  });

  it('carries the competition hashtag', () => {
    expect(shareText(RUN)).toContain('#IEEEMetaverse');
  });

  it('claims no team or affiliation that was never supplied', () => {
    // The brief's example line carried a placeholder team name. A result card
    // is the artefact most likely to be shared onward, so it must not assert
    // an affiliation nobody gave us.
    const text = shareText(RUN);
    expect(text).not.toMatch(/Team\s+\w+/i);
    expect(text).not.toContain('XYZ');
  });
});
