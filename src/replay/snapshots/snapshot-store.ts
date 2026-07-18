import type { SnapshotId } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { Token } from '@core';

import type { Snapshot } from '../model';

/**
 * Stores periodic state snapshots and finds the nearest one at or before a given
 * tick, so seeking during replay is O(1) restore + short fast-forward rather
 * than replaying from tick zero.
 */
export interface ISnapshotStore {
  put(snapshot: Snapshot): void;
  get(id: SnapshotId): Snapshot | undefined;
  /** Nearest snapshot at or before `tick`, if any. */
  nearest(tick: number): Snapshot | undefined;
  clear(): void;
}

export const SNAPSHOT_STORE: Token<ISnapshotStore> = createToken('SnapshotStore');

/**
 * Placeholder snapshot store.
 *
 * PHASE 8 will keep an ordered set of snapshots and binary-search for the
 * nearest prior snapshot on seek.
 */
export class PlaceholderSnapshotStore implements ISnapshotStore {
  public put(snapshot: Snapshot): void {
    notImplemented('SnapshotStore.put', 'Insert a snapshot in tick order.', { snapshot });
  }

  public get(id: SnapshotId): Snapshot | undefined {
    return notImplemented('SnapshotStore.get', 'Look up a snapshot by id.', { id });
  }

  public nearest(tick: number): Snapshot | undefined {
    return notImplemented('SnapshotStore.nearest', 'Find nearest snapshot at or before tick.', {
      tick,
    });
  }

  public clear(): void {
    notImplemented('SnapshotStore.clear', 'Drop all snapshots.');
  }
}
