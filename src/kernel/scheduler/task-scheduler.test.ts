import { asSeconds } from '@app-types';
import { describe, expect, it } from 'vitest';

import { createSimClock } from '../time/sim-clock';
import { createTaskScheduler } from './task-scheduler';

const tickThrough = (
  clock: ReturnType<typeof createSimClock>,
  scheduler: ReturnType<typeof createTaskScheduler>,
  ticks: number,
): void => {
  for (let i = 0; i < ticks; i += 1) {
    clock.advance();
    scheduler.runDue();
  }
};

describe('TaskScheduler', () => {
  it('runs a task at a specific tick, once', () => {
    const clock = createSimClock(asSeconds(0.1));
    const scheduler = createTaskScheduler(clock);
    const fired: number[] = [];
    scheduler.atTick(3, () => fired.push(clock.tick));
    tickThrough(clock, scheduler, 6);
    expect(fired).toEqual([3]);
  });

  it('runs a task N ticks later', () => {
    const clock = createSimClock(asSeconds(0.1));
    const scheduler = createTaskScheduler(clock);
    const fired: number[] = [];
    scheduler.afterTicks(2, () => fired.push(clock.tick));
    tickThrough(clock, scheduler, 5);
    expect(fired).toEqual([2]);
  });

  it('runs a task on the next tick', () => {
    const clock = createSimClock(asSeconds(0.1));
    const scheduler = createTaskScheduler(clock);
    const fired: number[] = [];
    scheduler.atNextTick(() => fired.push(clock.tick));
    tickThrough(clock, scheduler, 3);
    expect(fired).toEqual([1]);
  });

  it('repeats every N ticks', () => {
    const clock = createSimClock(asSeconds(0.1));
    const scheduler = createTaskScheduler(clock);
    const fired: number[] = [];
    scheduler.everyTicks(2, () => fired.push(clock.tick));
    tickThrough(clock, scheduler, 7);
    expect(fired).toEqual([2, 4, 6]);
  });

  it('runs a task at a simulation time', () => {
    const clock = createSimClock(asSeconds(0.1)); // 10 Hz
    const scheduler = createTaskScheduler(clock);
    const fired: number[] = [];
    scheduler.atSimTime(0.25, () => fired.push(clock.tick));
    tickThrough(clock, scheduler, 6);
    expect(fired).toEqual([3]); // ceil(0.25 / 0.1) = 3
  });

  it('executes same-tick tasks by priority then scheduling order', () => {
    const clock = createSimClock(asSeconds(0.1));
    const scheduler = createTaskScheduler(clock);
    const order: string[] = [];
    scheduler.atTick(1, () => order.push('low-first'), 0);
    scheduler.atTick(1, () => order.push('high'), 10);
    scheduler.atTick(1, () => order.push('low-second'), 0);
    tickThrough(clock, scheduler, 2);
    expect(order).toEqual(['high', 'low-first', 'low-second']);
  });

  it('cancels a pending task', () => {
    const clock = createSimClock(asSeconds(0.1));
    const scheduler = createTaskScheduler(clock);
    const fired: number[] = [];
    const task = scheduler.atTick(2, () => fired.push(clock.tick));
    task.cancel();
    tickThrough(clock, scheduler, 4);
    expect(fired).toEqual([]);
  });

  it('cancels a repeating task', () => {
    const clock = createSimClock(asSeconds(0.1));
    const scheduler = createTaskScheduler(clock);
    const fired: number[] = [];
    const task = scheduler.everyTicks(1, () => {
      fired.push(clock.tick);
      if (clock.tick === 2) task.cancel();
    });
    tickThrough(clock, scheduler, 6);
    expect(fired).toEqual([1, 2]);
  });

  it('is deterministic across identical runs', () => {
    const build = (): string[] => {
      const clock = createSimClock(asSeconds(0.1));
      const scheduler = createTaskScheduler(clock);
      const log: string[] = [];
      scheduler.everyTicks(2, () => log.push(`even@${clock.tick}`));
      scheduler.atTick(3, () => log.push('three'));
      scheduler.afterTicks(1, () => log.push('soon'));
      tickThrough(clock, scheduler, 6);
      return log;
    };
    expect(build()).toEqual(build());
  });
});
