import { createToken } from '@core';
import type { Token } from '@core';
import type { KernelSnapshot } from '@kernel';

/**
 * Stores periodic kernel snapshots (tick-ordered) and finds the nearest one at
 * or before a given tick, so seeking during replay is an O(1) restore plus a
 * short fast-forward rather than replaying from tick zero.
 */
export interface SnapshotStore {
  put(snapshot: KernelSnapshot): void;
  at(tick: number): KernelSnapshot | undefined;
  /** Nearest snapshot at or before `tick`, if any. */
  nearest(tick: number): KernelSnapshot | undefined;
  clear(): void;
  readonly size: number;
}

export const SNAPSHOT_STORE: Token<SnapshotStore> = createToken('SnapshotStore');

export function createSnapshotStore(): SnapshotStore {
  const snapshots: KernelSnapshot[] = []; // kept sorted by tick

  return {
    get size(): number {
      return snapshots.length;
    },
    put(snapshot: KernelSnapshot): void {
      const existing = snapshots.findIndex((entry) => entry.tick === snapshot.tick);
      if (existing >= 0) {
        snapshots[existing] = snapshot;
        return;
      }
      const insertAt = snapshots.findIndex((entry) => entry.tick > snapshot.tick);
      if (insertAt < 0) {
        snapshots.push(snapshot);
      } else {
        snapshots.splice(insertAt, 0, snapshot);
      }
    },
    at(tick: number): KernelSnapshot | undefined {
      return snapshots.find((entry) => entry.tick === tick);
    },
    nearest(tick: number): KernelSnapshot | undefined {
      let best: KernelSnapshot | undefined;
      for (const entry of snapshots) {
        if (entry.tick <= tick) {
          best = entry;
        } else {
          break;
        }
      }
      return best;
    },
    clear(): void {
      snapshots.length = 0;
    },
  };
}
