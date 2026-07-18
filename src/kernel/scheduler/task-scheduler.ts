import { GridGuardError } from '@core';
import type { Clock } from '@core';

/** Handle to a scheduled task; call `cancel()` to remove it before it fires. */
export interface ScheduledTask {
  readonly id: number;
  cancel(): void;
}

/**
 * A deterministic, tick-driven scheduler. It NEVER uses `setTimeout`,
 * `setInterval`, or any browser timer — every task fires as a function of the
 * simulation clock, so scheduling is fully reproducible. The kernel calls
 * `runDue()` once per tick, after advancing the clock.
 *
 * Same-tick tasks execute in a deterministic order: earliest target tick, then
 * highest priority, then scheduling order.
 */
export interface TaskScheduler {
  /** Run `callback` when the clock reaches `tick`. */
  atTick(tick: number, callback: () => void, priority?: number): ScheduledTask;
  /** Run `callback` `ticks` ticks from now. */
  afterTicks(ticks: number, callback: () => void, priority?: number): ScheduledTask;
  /** Run `callback` on the next tick. */
  atNextTick(callback: () => void, priority?: number): ScheduledTask;
  /** Run `callback` every `interval` ticks, starting `interval` ticks from now. */
  everyTicks(interval: number, callback: () => void, priority?: number): ScheduledTask;
  /** Run `callback` at the first tick whose simulated time reaches `seconds`. */
  atSimTime(seconds: number, callback: () => void, priority?: number): ScheduledTask;
  /** Execute all tasks due at the current clock tick (called by the kernel). */
  runDue(): void;
  readonly pendingCount: number;
  clear(): void;
}

interface TaskRecord {
  readonly id: number;
  readonly priority: number;
  readonly seq: number;
  readonly interval: number | null;
  readonly callback: () => void;
  targetTick: number;
  cancelled: boolean;
}

export function createTaskScheduler(clock: Clock): TaskScheduler {
  const tasks = new Map<number, TaskRecord>();
  let nextId = 0;

  const schedule = (
    targetTick: number,
    callback: () => void,
    priority: number,
    interval: number | null,
  ): ScheduledTask => {
    const id = nextId;
    nextId += 1;
    const record: TaskRecord = {
      id,
      priority,
      seq: id,
      interval,
      callback,
      targetTick,
      cancelled: false,
    };
    tasks.set(id, record);
    return {
      id,
      cancel(): void {
        record.cancelled = true;
        tasks.delete(id);
      },
    };
  };

  return {
    atTick: (tick, callback, priority = 0) => schedule(tick, callback, priority, null),
    afterTicks(ticks, callback, priority = 0) {
      if (ticks < 0) {
        throw new GridGuardError(`afterTicks requires ticks >= 0, got ${ticks}`);
      }
      return schedule(clock.tick + ticks, callback, priority, null);
    },
    atNextTick: (callback, priority = 0) => schedule(clock.tick + 1, callback, priority, null),
    everyTicks(interval, callback, priority = 0) {
      if (interval <= 0) {
        throw new GridGuardError(`everyTicks requires interval > 0, got ${interval}`);
      }
      return schedule(clock.tick + interval, callback, priority, interval);
    },
    atSimTime(seconds, callback, priority = 0) {
      const step = clock.timestep as number;
      return schedule(Math.ceil(seconds / step), callback, priority, null);
    },
    runDue(): void {
      const currentTick = clock.tick;
      const due = [...tasks.values()]
        .filter((task) => !task.cancelled && task.targetTick <= currentTick)
        .sort((a, b) => a.targetTick - b.targetTick || b.priority - a.priority || a.seq - b.seq);

      for (const task of due) {
        if (task.cancelled) continue;
        task.callback();
        if (task.interval !== null && !task.cancelled) {
          task.targetTick += task.interval;
        } else {
          tasks.delete(task.id);
        }
      }
    },
    get pendingCount(): number {
      return tasks.size;
    },
    clear(): void {
      tasks.clear();
    },
  };
}
