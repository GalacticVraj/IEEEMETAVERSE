import { describe, expect, it } from 'vitest';

import { createDiagnostics } from './diagnostics';

describe('Diagnostics', () => {
  it('records tick durations and aggregates them', () => {
    let now = 0;
    const diagnostics = createDiagnostics(() => now);

    now = 0;
    diagnostics.beginTick();
    now = 5;
    diagnostics.endTick();

    now = 10;
    diagnostics.beginTick();
    now = 13;
    diagnostics.endTick();

    const report = diagnostics.report();
    expect(report.ticks).toBe(2);
    expect(report.lastTickMs).toBe(3);
    expect(report.maxTickMs).toBe(5);
    expect(report.averageTickMs).toBe(4);
  });

  it('tracks per-system execution time and the slowest system', () => {
    let now = 0;
    const diagnostics = createDiagnostics(() => now);

    now = 0;
    diagnostics.beginSystem('weather');
    now = 2;
    diagnostics.endSystem('weather');

    now = 2;
    diagnostics.beginSystem('powerflow');
    now = 7;
    diagnostics.endSystem('powerflow');

    const report = diagnostics.report();
    expect(report.systemMs['weather']).toBe(2);
    expect(report.systemMs['powerflow']).toBe(5);
    expect(report.slowestSystem).toEqual({ id: 'powerflow', ms: 5 });
  });

  it('accumulates system time across ticks', () => {
    let now = 0;
    const diagnostics = createDiagnostics(() => now);
    for (let i = 0; i < 3; i += 1) {
      now = i * 10;
      diagnostics.beginSystem('weather');
      now = i * 10 + 2;
      diagnostics.endSystem('weather');
    }
    expect(diagnostics.report().systemMs['weather']).toBe(6);
  });

  it('resets all counters', () => {
    let now = 0;
    const diagnostics = createDiagnostics(() => now);
    diagnostics.beginTick();
    now = 5;
    diagnostics.endTick();
    diagnostics.reset();
    const report = diagnostics.report();
    expect(report.ticks).toBe(0);
    expect(report.slowestSystem).toBeNull();
  });
});
