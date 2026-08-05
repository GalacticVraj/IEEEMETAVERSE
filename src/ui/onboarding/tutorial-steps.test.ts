import { ALL_PANELS } from '@state';
import { describe, expect, it } from 'vitest';

import { TUTORIAL_BEATS } from './tutorial-steps';

describe('tutorial-steps', () => {
  it('gives every beat a unique id', () => {
    const ids = TUTORIAL_BEATS.map((beat) => beat.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('discloses every console panel exactly once', () => {
    const revealed = TUTORIAL_BEATS.flatMap((beat) =>
      beat.reveals === undefined ? [] : [beat.reveals],
    );

    // This is the guard that matters: if a future edit drops or duplicates a
    // beat's `reveals`, a console panel would silently never appear.
    expect([...revealed].sort()).toEqual([...ALL_PANELS].sort());
  });

  it('reveals panels in the same order the store lists them', () => {
    const revealed = TUTORIAL_BEATS.flatMap((beat) =>
      beat.reveals === undefined ? [] : [beat.reveals],
    );
    expect(revealed).toEqual([...ALL_PANELS]);
  });

  it('gives every beat something to say', () => {
    for (const beat of TUTORIAL_BEATS) {
      expect(beat.lines.length).toBeGreaterThan(0);
      for (const line of beat.lines) {
        expect(line.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('gives every interaction gate an escape hatch so a demo cannot stall', () => {
    const gated = TUTORIAL_BEATS.filter((beat) => beat.gate.kind === 'select-asset');

    // An interaction gate that a player never satisfies would freeze the
    // tutorial in front of judges. Every one must time out into a fallback.
    expect(gated.length).toBeGreaterThan(0);
    for (const beat of gated) {
      if (beat.gate.kind !== 'select-asset') throw new Error('narrowing');
      expect(beat.gate.fallbackMs).toBeGreaterThan(0);
      expect(beat.gate.fallbackAssetId.length).toBeGreaterThan(0);
    }
  });

  it('ends on the scenario pick so the tutorial hands straight over to a run', () => {
    const last = TUTORIAL_BEATS[TUTORIAL_BEATS.length - 1];
    expect(last?.reveals).toBe('scenario');
  });
});
