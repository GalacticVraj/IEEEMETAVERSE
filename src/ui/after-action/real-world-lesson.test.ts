import { describe, expect, it } from 'vitest';

import { selectLesson } from './real-world-lesson';
import type { LessonInput } from './real-world-lesson';

const CLEAN_RUN: LessonInput = {
  uflsFired: false,
  zonesDarkened: 0,
  lineTrips: 0,
  peakCorridorStress: 0.6,
  renewableShare: 0.15,
  improvedDecisions: 0,
  totalDecisions: 2,
  held: true,
};

describe('selectLesson', () => {
  it('always returns a titled paragraph', () => {
    const lesson = selectLesson(CLEAN_RUN);
    expect(lesson.title.length).toBeGreaterThan(0);
    expect(lesson.body.length).toBeGreaterThan(200);
  });

  it('teaches load shedding when the relays actually fired', () => {
    expect(selectLesson({ ...CLEAN_RUN, uflsFired: true }).title).toMatch(/load shedding/i);
  });

  it('prefers UFLS over every other lesson — it is the loudest thing that happened', () => {
    const everything: LessonInput = {
      uflsFired: true,
      zonesDarkened: 3,
      lineTrips: 5,
      peakCorridorStress: 1,
      renewableShare: 0.9,
      improvedDecisions: 4,
      totalDecisions: 4,
      held: false,
    };
    expect(selectLesson(everything).title).toMatch(/load shedding/i);
  });

  it('teaches outage allocation when a district went dark', () => {
    expect(selectLesson({ ...CLEAN_RUN, zonesDarkened: 1 }).title).toMatch(/outages/i);
  });

  it('teaches cascades when protection operated', () => {
    expect(selectLesson({ ...CLEAN_RUN, lineTrips: 1 }).title).toMatch(/cascade/i);
  });

  it('teaches cascades when a corridor was pushed to its limit without tripping', () => {
    expect(selectLesson({ ...CLEAN_RUN, peakCorridorStress: 0.97 }).title).toMatch(/cascade/i);
  });

  it('names demand response when an intervention measurably worked', () => {
    expect(selectLesson({ ...CLEAN_RUN, improvedDecisions: 1 }).title).toMatch(/demand response/i);
  });

  it('teaches inertia on a renewable-heavy run with no faults', () => {
    expect(selectLesson({ ...CLEAN_RUN, renewableShare: 0.4 }).title).toMatch(/inertia/i);
  });

  it('calls out an unmanaged grid when the player never acted', () => {
    expect(selectLesson({ ...CLEAN_RUN, totalDecisions: 0 }).title).toMatch(/unmanaged/i);
  });

  it('falls back to the balance lesson for a quiet, well-run shift', () => {
    expect(selectLesson(CLEAN_RUN).title).toMatch(/supply and demand/i);
  });

  it('is a pure function of its input', () => {
    const input = { ...CLEAN_RUN, lineTrips: 2 };
    expect(selectLesson(input)).toEqual(selectLesson(input));
  });
});
