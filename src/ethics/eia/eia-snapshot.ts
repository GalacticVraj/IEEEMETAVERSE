/**
 * Shape of the real-world energy data that grounds the simulation and the
 * ethics/equity narrative. In production this is fetched ONCE from the EIA Open
 * Data API v2 at build time and bundled as static JSON — there is no runtime
 * dependency on the API during a demo.
 */
export interface EiaRecord {
  /** Reporting period, e.g. an ISO date or "2025-07". */
  readonly period: string;
  readonly value: number;
  readonly unit: string;
}

export interface EiaSnapshot {
  readonly source: string;
  /** ISO timestamp of when the snapshot was fetched. */
  readonly fetchedAt: string;
  readonly region: string;
  readonly records: readonly EiaRecord[];
}

/**
 * Placeholder snapshot. PHASE 6 replaces this with a build-time fetch of real
 * EIA series (regional demand, generation mix). Kept empty and clearly labeled
 * so nothing downstream mistakes it for real calibrated data.
 */
export const EMPTY_EIA_SNAPSHOT: EiaSnapshot = {
  source: 'EIA Open Data API v2 (placeholder — not yet fetched)',
  fetchedAt: '1970-01-01T00:00:00.000Z',
  region: 'US-PLACEHOLDER',
  records: [],
};
