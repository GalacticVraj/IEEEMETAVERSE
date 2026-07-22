import { asSeconds } from '@app-types';
import { GRID_EVENT } from '@constants';
import type { GridEventBus } from '@core';
import { createSimulationKernel } from '@kernel';
import { beforeEach, describe, expect, it } from 'vitest';

import { bindAdvisor, pushEvidenceFeedback, pushRunOpener, useAdvisorStore } from './advisor-store';

const makeBus = (): GridEventBus =>
  createSimulationKernel({ seed: 1 }).events as unknown as GridEventBus;

let fakeNow = 0;
const now = (): number => fakeNow;

describe('in-play advisor', () => {
  beforeEach(() => {
    fakeNow = 100_000;
    useAdvisorStore.setState({ current: null, lastShownAt: -Infinity });
  });

  it('asks a grounded question when corridor stress crosses 90 %', () => {
    const bus = makeBus();
    const unbind = bindAdvisor(bus, { now });

    bus.emit(GRID_EVENT.PowerFlowSolved, { converged: true, iterations: 1, maxLoading: 0.82 as never });
    expect(useAdvisorStore.getState().current).toBeNull();

    bus.emit(GRID_EVENT.PowerFlowSolved, { converged: true, iterations: 1, maxLoading: 0.93 as never });
    const message = useAdvisorStore.getState().current;
    expect(message?.kind).toBe('question');
    expect(message?.text).toContain('93');

    unbind();
  });

  it('explains the first protection trip with the real line id and timestamp', () => {
    const bus = makeBus();
    const unbind = bindAdvisor(bus, { now });

    bus.emit(GRID_EVENT.SimulationTick, { tick: 410, simTime: asSeconds(41), timestep: asSeconds(0.1) });
    bus.emit(GRID_EVENT.LineTripped, { line: 'GS1-DT1' as never, cause: 'Overload' as never });

    const message = useAdvisorStore.getState().current;
    expect(message?.kind).toBe('explanation');
    expect(message?.text).toContain('GS1-DT1');
    expect(message?.text).toContain('T+00:41');

    unbind();
  });

  it('enforces the 20-second cooldown between messages', () => {
    const bus = makeBus();
    const unbind = bindAdvisor(bus, { now });

    bus.emit(GRID_EVENT.PowerFlowSolved, { converged: true, iterations: 1, maxLoading: 0.95 as never });
    const first = useAdvisorStore.getState().current;
    expect(first).not.toBeNull();

    fakeNow += 5_000; // within cooldown
    bus.emit(GRID_EVENT.LineTripped, { line: 'DT1-DT2' as never, cause: 'Overload' as never });
    expect(useAdvisorStore.getState().current?.id).toBe(first?.id);

    fakeNow += 20_000; // cooldown passed
    bus.emit(GRID_EVENT.LineTripped, { line: 'DT2-DT3' as never, cause: 'Overload' as never });
    expect(useAdvisorStore.getState().current?.text).toContain('DT2-DT3');

    unbind();
  });

  it('reinforces recovery after a blackout, citing the zone', () => {
    const bus = makeBus();
    const unbind = bindAdvisor(bus, { now });

    bus.emit(GRID_EVENT.ZoneBlackout, { zone: 'HB' as never, unservedLoad: 60 as never });
    fakeNow += 30_000;
    bus.emit(GRID_EVENT.ZonePowered, { zone: 'HB' as never });

    const message = useAdvisorStore.getState().current;
    expect(message?.kind).toBe('reinforcement');
    expect(message?.text).toContain('Harbor');

    unbind();
  });

  it('opens later runs with the learner’s real history, never on run 1', () => {
    pushRunOpener(
      { attempt: 1, blackouts_caused: 0, weak_concept_tags: [], decisions_made: 0 },
      now(),
    );
    expect(useAdvisorStore.getState().current).toBeNull();

    pushRunOpener(
      { attempt: 2, blackouts_caused: 1, weak_concept_tags: ['Cascading Failure'], decisions_made: 3 },
      now(),
    );
    const message = useAdvisorStore.getState().current;
    expect(message?.text).toContain('Shift #2');
    expect(message?.text).toContain('1 district blackout');
    expect(message?.text).toContain('Cascading Failure');
  });

  it('reports measured decision feedback with the real before/after numbers', () => {
    fakeNow += 30_000;
    pushEvidenceFeedback(
      {
        decisionId: 'op-ac-residential-120',
        verdict: 'improved',
        pre: { maxLoading: 0.96 },
        post: { maxLoading: 0.78 },
      },
      now(),
    );
    const message = useAdvisorStore.getState().current;
    expect(message?.kind).toBe('feedback');
    expect(message?.text).toContain('96');
    expect(message?.text).toContain('78');
    expect(message?.text).toContain('Reduce residential AC');
  });
});
