/* eslint-disable @typescript-eslint/no-magic-numbers -- FNV-1a hash constants */
import { isSnapshotable } from '@core';
import type { Clock, ClockState, KernelEventMap, Rng, RngState, SimulationSystem } from '@core';

/**
 * An authoritative simulation-state snapshot. Contains ONLY simulation state —
 * never renderer or UI state. Deterministic: two runs at the same tick produce
 * byte-identical snapshots and therefore identical hashes.
 */
export interface KernelSnapshot {
  readonly tick: number;
  readonly clock: ClockState;
  readonly rng: RngState;
  /** Per-system captured state, keyed by system id. */
  readonly systems: Readonly<Record<string, unknown>>;
}

/**
 * Deterministic serialization: JSON with recursively sorted object keys, so the
 * output depends only on values, not on insertion order. This is what makes
 * snapshot hashes stable across runs.
 */
export function canonicalize(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${(value as unknown[]).map(canonicalize).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
}

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a 32-bit hash of a string, as 8 hex digits. Deterministic and fast. */
export function hashString(text: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Capture the authoritative state of the clock, rng, and all systems. */
export function captureKernelSnapshot<TEvents extends KernelEventMap = KernelEventMap>(
  clock: Clock,
  rng: Rng,
  systems: readonly SimulationSystem<TEvents>[],
): KernelSnapshot {
  const systemStates: Record<string, unknown> = {};
  for (const system of systems) {
    if (isSnapshotable(system)) {
      systemStates[String(system.id)] = system.captureState();
    }
  }
  return {
    tick: clock.tick,
    clock: clock.getState(),
    rng: rng.getState(),
    systems: systemStates,
  };
}

/** Restore clock, rng, and system state from a snapshot. */
export function restoreKernelSnapshot<TEvents extends KernelEventMap = KernelEventMap>(
  snapshot: KernelSnapshot,
  clock: Clock,
  rng: Rng,
  systems: readonly SimulationSystem<TEvents>[],
): void {
  clock.setState(snapshot.clock);
  rng.setState(snapshot.rng);
  for (const system of systems) {
    if (isSnapshotable(system)) {
      const state = snapshot.systems[String(system.id)];
      if (state !== undefined) {
        system.restoreState(state);
      }
    }
  }
}

export function serializeSnapshot(snapshot: KernelSnapshot): string {
  return canonicalize(snapshot);
}

export function hashSnapshot(snapshot: KernelSnapshot): string {
  return hashString(serializeSnapshot(snapshot));
}

export interface SnapshotComparison {
  readonly equal: boolean;
  readonly hashA: string;
  readonly hashB: string;
}

export function compareSnapshots(a: KernelSnapshot, b: KernelSnapshot): SnapshotComparison {
  const hashA = hashSnapshot(a);
  const hashB = hashSnapshot(b);
  return { equal: hashA === hashB, hashA, hashB };
}
