import { describe, expect, it } from 'vitest';

import {
  INTRO_LEGS,
  OPERATOR_HOME,
  TIMING_SECONDS,
  frameLine,
  frameNode,
  frameZone,
  shotForDecision,
  shotForFocus,
  zoneCentroid,
} from './shots';

const dist = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0));

describe('timing presets', () => {
  it('defines all four presets with FAST < NORMAL < SLOW < CINEMATIC', () => {
    expect(TIMING_SECONDS.FAST).toBeLessThan(TIMING_SECONDS.NORMAL);
    expect(TIMING_SECONDS.NORMAL).toBeLessThan(TIMING_SECONDS.SLOW);
    expect(TIMING_SECONDS.SLOW).toBeLessThan(TIMING_SECONDS.CINEMATIC);
  });
});

describe('framing math', () => {
  it('frameNode looks at the node from above with a comfortable distance', () => {
    const shot = frameNode('Inspect_Generator', [80, 65]);
    expect(shot.pose.target[0]).toBe(80);
    expect(shot.pose.target[2]).toBe(65);
    expect(shot.pose.position[1]).toBeGreaterThan(shot.pose.target[1]); // above
    expect(dist(shot.pose.position, shot.pose.target)).toBeGreaterThanOrEqual(55); // never too tight
  });

  it('frameLine centers on the midpoint and scales distance with length', () => {
    const short = frameLine('Inspect_Line', [0, 0], [10, 0]);
    const long = frameLine('Inspect_Line', [-75, 80], [80, 65]);
    expect(short.pose.target[0]).toBeCloseTo(5);
    expect(long.pose.target[0]).toBeCloseTo(2.5);
    expect(dist(long.pose.position, long.pose.target)).toBeGreaterThan(
      dist(short.pose.position, short.pose.target),
    );
    expect(dist(short.pose.position, short.pose.target)).toBeGreaterThanOrEqual(54.9);
  });

  it('frameZone frames the centroid from higher up', () => {
    const shot = frameZone('Inspect_District', [0, 60], 30);
    expect(shot.pose.target[0]).toBe(0);
    expect(shot.pose.target[2]).toBe(60);
    expect(dist(shot.pose.position, shot.pose.target)).toBeGreaterThanOrEqual(75);
  });

  it('zoneCentroid averages the positions of the zone buses', () => {
    const [cx, cz] = zoneCentroid('DT');
    // DT buses: [-10,75],[10,75],[0,60],[-15,60],[15,60] → mean (0, 66)
    expect(cx).toBeCloseTo(0);
    expect(cz).toBeCloseTo(66);
  });
});

describe('event focus → shots', () => {
  it('maps a line focus to a real corridor framing', () => {
    const shot = shotForFocus({ kind: 'line', id: 'DT1-DT2' });
    expect(shot).not.toBeNull();
    // midpoint of DT1 [-10,75] and DT2 [10,75]
    expect(shot?.pose.target[0]).toBeCloseTo(0);
    expect(shot?.pose.target[2]).toBeCloseTo(75);
  });

  it('maps a generator focus to its bus position', () => {
    const shot = shotForFocus({ kind: 'generator', id: 'G-BASE-S' }); // at GS1 [80,65]
    expect(shot?.pose.target[0]).toBeCloseTo(80);
    expect(shot?.pose.target[2]).toBeCloseTo(65);
  });

  it('maps a zone focus to the zone centroid', () => {
    const shot = shotForFocus({ kind: 'zone', id: 'DT' });
    expect(shot?.pose.target[0]).toBeCloseTo(0);
    expect(shot?.pose.target[2]).toBeCloseTo(66);
  });

  it('returns null for unknown assets instead of inventing a frame', () => {
    expect(shotForFocus({ kind: 'line', id: 'NOPE-NADA' })).toBeNull();
    expect(shotForFocus({ kind: 'generator', id: 'G-UNKNOWN' })).toBeNull();
  });
});

describe('decision → shots', () => {
  it('maps standing operator actions to their affected districts', () => {
    expect(shotForDecision('op-lights-commercial-120')?.pose.target[2]).toBeCloseTo(66); // DT
    const industrial = shotForDecision('op-shed-industrial-120');
    const [ix, iz] = zoneCentroid('IN');
    expect(industrial?.pose.target[0]).toBeCloseTo(ix);
    expect(industrial?.pose.target[2]).toBeCloseTo(iz);
  });

  it('maps city-wide actions to a wide city frame', () => {
    const shot = shotForDecision('op-ev-pause-42');
    expect(shot).not.toBeNull();
    expect(dist(shot!.pose.position, shot!.pose.target)).toBeGreaterThan(200); // wide
  });
});

describe('intro', () => {
  it('has an establishing leg, district legs, and non-empty captions', () => {
    expect(INTRO_LEGS.length).toBeGreaterThanOrEqual(6);
    for (const leg of INTRO_LEGS) {
      expect(leg.caption.length).toBeGreaterThan(0);
    }
  });

  it('operator home is a stable, elevated overview', () => {
    expect(OPERATOR_HOME.pose.position[1]).toBeGreaterThan(100);
    expect(OPERATOR_HOME.name).toBe('OperatorHome');
  });
});
