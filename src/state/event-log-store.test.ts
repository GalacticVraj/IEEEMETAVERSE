import { asCelsius, asMegaWatts } from '@app-types';
import { GRID_EVENT } from '@constants';
import type { GridEventBus } from '@core';
import { createSimulationKernel } from '@kernel';
import { beforeEach, describe, expect, it } from 'vitest';

import { bindEventLog, useEventLogStore } from './event-log-store';

const makeBus = (): GridEventBus =>
  createSimulationKernel({ seed: 1 }).events as unknown as GridEventBus;

describe('event log store', () => {
  beforeEach(() => {
    useEventLogStore.getState().clear();
  });

  it('logs line trips and recoveries in order with severities', () => {
    const bus = makeBus();
    const unbind = bindEventLog(bus);

    bus.emit(GRID_EVENT.LineTripped, { line: 'DT1-DT2' as never, cause: 'Overload' as never });
    bus.emit(GRID_EVENT.LineRecovered, { line: 'DT1-DT2' as never });

    const entries = useEventLogStore.getState().entries;
    expect(entries).toHaveLength(2);
    expect(entries[0]?.severity).toBe('critical');
    expect(entries[0]?.title).toContain('DT1-DT2');
    expect(entries[1]?.severity).toBe('recovery');
    expect(entries[1]?.seq).toBeGreaterThan(entries[0]?.seq ?? 0);

    unbind();
  });

  it('dedupes per-zone state — repeated ZonePowered for the same zone logs once', () => {
    const bus = makeBus();
    const unbind = bindEventLog(bus);

    bus.emit(GRID_EVENT.ZonePowered, { zone: 'DT' as never });
    bus.emit(GRID_EVENT.ZonePowered, { zone: 'DT' as never });
    bus.emit(GRID_EVENT.ZonePowered, { zone: 'DT' as never });
    // Initial "Powered" is the baseline state — nothing noteworthy happened.
    expect(useEventLogStore.getState().entries).toHaveLength(0);

    bus.emit(GRID_EVENT.ZoneBlackout, { zone: 'DT' as never, unservedLoad: asMegaWatts(80) });
    bus.emit(GRID_EVENT.ZoneBlackout, { zone: 'DT' as never, unservedLoad: asMegaWatts(80) });
    expect(useEventLogStore.getState().entries).toHaveLength(1);

    bus.emit(GRID_EVENT.ZonePowered, { zone: 'DT' as never });
    const entries = useEventLogStore.getState().entries;
    expect(entries).toHaveLength(2);
    expect(entries[1]?.severity).toBe('recovery');

    unbind();
  });

  it('logs weather only when the kind changes', () => {
    const bus = makeBus();
    const unbind = bindEventLog(bus);

    bus.emit(GRID_EVENT.WeatherChanged, { kind: 'Heatwave' as never, temperature: asCelsius(41) });
    bus.emit(GRID_EVENT.WeatherChanged, { kind: 'Heatwave' as never, temperature: asCelsius(42) });
    bus.emit(GRID_EVENT.WeatherChanged, { kind: 'Storm' as never, temperature: asCelsius(18) });

    expect(useEventLogStore.getState().entries).toHaveLength(2);

    unbind();
  });

  it('caps the ring buffer at 200 entries', () => {
    const bus = makeBus();
    const unbind = bindEventLog(bus);

    for (let i = 0; i < 250; i++) {
      bus.emit(GRID_EVENT.LineTripped, { line: `L-${i}` as never, cause: 'Overload' as never });
    }
    const { entries } = useEventLogStore.getState();
    expect(entries).toHaveLength(200);
    expect(entries[entries.length - 1]?.title).toContain('L-249');

    unbind();
  });
});
