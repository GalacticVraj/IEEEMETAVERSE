import { asSystemId } from '@app-types';
import type { KernelEventMap, Rng, SimulationSystem, TypedEventBus } from '@core';
import { createEventBus } from '@core';
import { createSimulationKernel } from '@kernel';
import { describe, expect, it } from 'vitest';

import { createReplayPlayer } from './playback/player';
import { createReplayRecorder } from './recording/recorder';
import { createReplaySerializer } from './serialization/replay-serializer';
import { createJsonReplayBackend } from './serialization/json-backend';
import { createReplayVerifier } from './verification/replay-verifier';
import type { RecordedEvent } from './model';

/** A test event map: the kernel events plus an rng-dependent domain event. */
interface TestEvents extends KernelEventMap {
  Draw: { readonly value: number };
}

const drawSystem = (): SimulationSystem<TestEvents> => {
  let rng: Rng | null = null;
  let events: TypedEventBus<TestEvents> | null = null;
  return {
    id: asSystemId('draw'),
    init: (context) => {
      rng = context.rng;
      events = context.events;
    },
    step: () => {
      if (rng !== null && events !== null) {
        events.emit('Draw', { value: rng.next() });
      }
    },
    reset: () => undefined,
    dispose: () => undefined,
  };
};

const recordRun = (seed: number, ticks: number) => {
  const kernel = createSimulationKernel<TestEvents>({ seed });
  kernel.register(drawSystem());
  const recorder = createReplayRecorder<TestEvents>();
  recorder.start({ seed, version: 'test', configHash: 'cfg', bus: kernel.events });
  kernel.boot();
  kernel.start();
  for (let i = 0; i < ticks; i += 1) {
    kernel.tick();
    recorder.checkpoint(kernel.clock.tick, kernel.hash());
  }
  return recorder.stop(kernel.clock.tick);
};

describe('replay', () => {
  it('records the rng-dependent event stream', () => {
    const recording = recordRun(7, 5);
    const draws = recording.events.filter((event) => event.name === 'Draw');
    expect(draws).toHaveLength(5);
    expect(recording.metadata.seed).toBe(7);
    expect(recording.checkpoints).toHaveLength(5);
  });

  it('verifies two identical runs as deterministic', () => {
    const verifier = createReplayVerifier();
    const report = verifier.verify(recordRun(7, 6), recordRun(7, 6));
    expect(report.deterministic).toBe(true);
    expect(report.divergedAtTick).toBeNull();
  });

  it('detects divergence between different seeds', () => {
    const verifier = createReplayVerifier();
    const report = verifier.verify(recordRun(7, 6), recordRun(8, 6));
    expect(report.deterministic).toBe(false);
    expect(report.divergedAtTick).toBe(1);
  });

  it('serializes and deserializes a recording losslessly', () => {
    const recording = recordRun(3, 4);
    const serializer = createReplaySerializer(createJsonReplayBackend());
    const text = serializer.serialize(recording);
    expect(text.ok).toBe(true);
    if (!text.ok) return;
    const restored = serializer.deserialize(text.value);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value).toEqual(recording);
  });

  it('plays a recording back onto a fresh bus', () => {
    const recording = recordRun(5, 3);
    const played: RecordedEvent[] = [];
    const bus = createEventBus<TestEvents>();
    const player = createReplayPlayer();
    player.load(recording);
    const collector = bus.onAny((envelope) =>
      played.push({
        tick: envelope.tick,
        seq: envelope.seq,
        name: String(envelope.name),
        payload: envelope.payload,
      }),
    );
    player.play(bus);
    collector();
    const drawsPlayed = played.filter((event) => event.name === 'Draw');
    expect(drawsPlayed).toHaveLength(3);
  });
});
