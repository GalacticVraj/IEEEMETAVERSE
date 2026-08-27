import { describe, expect, it } from 'vitest';

import { CRISIS_LEVEL_STYLE, assessCrisis, escalated } from './crisis-level';
import type { CrisisLevel, CrisisLevelInput } from './crisis-level';

const CALM: CrisisLevelInput = {
  active: true,
  frequencyHz: 60,
  maxLoading: 0.4,
  darkZones: 0,
  trippedLines: 0,
  uflsStage: 0,
  deficitMw: 0,
};

const level = (patch: Partial<CrisisLevelInput>): CrisisLevel =>
  assessCrisis({ ...CALM, ...patch }).level;

describe('assessCrisis', () => {
  it('reads standby until the shift starts, whatever the telemetry says', () => {
    expect(level({ active: false, frequencyHz: 58, darkZones: 4 })).toBe('standby');
  });

  it('is normal on a healthy grid', () => {
    expect(level({})).toBe('normal');
  });

  it('ignores normal frequency wander', () => {
    expect(level({ frequencyHz: 60.1 })).toBe('normal');
    expect(level({ frequencyHz: 59.9 })).toBe('normal');
  });

  it('warns on frequency drift in either direction', () => {
    expect(level({ frequencyHz: 59.7 })).toBe('warning');
    expect(level({ frequencyHz: 60.3 })).toBe('warning');
  });

  it('escalates to critical outside the 59.5-60.5 band, in either direction', () => {
    expect(level({ frequencyHz: 59.4 })).toBe('critical');
    expect(level({ frequencyHz: 60.6 })).toBe('critical');
  });

  it('warns at 60 % corridor loading and stays out of critical through the 80s', () => {
    expect(level({ maxLoading: 0.59 })).toBe('normal');
    expect(level({ maxLoading: 0.6 })).toBe('warning');
    // The whole point of the 95 % threshold: a run that sits in the 80s is
    // stressed, not collapsing, and the console must not cry wolf there.
    expect(level({ maxLoading: 0.88 })).toBe('warning');
    expect(level({ maxLoading: 0.95 })).toBe('critical');
  });

  it('treats a trip and automatic shedding as critical', () => {
    expect(level({ trippedLines: 1 })).toBe('critical');
    expect(level({ uflsStage: 1 })).toBe('critical');
  });

  it('escalates on supply deficit', () => {
    expect(level({ deficitMw: 39 })).toBe('normal');
    expect(level({ deficitMw: 40 })).toBe('warning');
    expect(level({ deficitMw: 150 })).toBe('critical');
  });

  it('lets a dark district outrank every healthy reading', () => {
    expect(level({ darkZones: 1 })).toBe('blackout');
  });

  it('quotes the measured cause, so a banner never says only "conditions worsened"', () => {
    expect(assessCrisis({ ...CALM, maxLoading: 0.72 }).reason).toContain('72 %');
    expect(assessCrisis({ ...CALM, frequencyHz: 59.31 }).reason).toContain('59.31');
    expect(assessCrisis({ ...CALM, darkZones: 3 }).reason).toContain('3 districts');
  });
});

describe('escalated', () => {
  it('fires on a rise and stays silent on a recovery', () => {
    expect(escalated('normal', 'warning')).toBe(true);
    expect(escalated('warning', 'blackout')).toBe(true);
    expect(escalated('critical', 'warning')).toBe(false);
    expect(escalated('warning', 'warning')).toBe(false);
  });
});

describe('CRISIS_LEVEL_STYLE', () => {
  it('covers every level', () => {
    for (const key of ['standby', 'normal', 'warning', 'critical', 'blackout'] as const) {
      expect(CRISIS_LEVEL_STYLE[key].label.length).toBeGreaterThan(0);
    }
  });

  it('only goes dark for blackout — the daylight console is not inverted by stress alone', () => {
    expect(CRISIS_LEVEL_STYLE.critical.barInk).toBe('#1C2530');
    expect(CRISIS_LEVEL_STYLE.blackout.barInk).toBe('#FAFAF7');
  });

  it('thickens the rail accent monotonically with severity', () => {
    expect(CRISIS_LEVEL_STYLE.normal.railWidth).toBeLessThan(CRISIS_LEVEL_STYLE.warning.railWidth);
    expect(CRISIS_LEVEL_STYLE.warning.railWidth).toBeLessThan(
      CRISIS_LEVEL_STYLE.critical.railWidth,
    );
  });
});
