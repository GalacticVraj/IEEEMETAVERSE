/**
 * Reserve accounting and N-1 contingency screening.
 *
 * The N-1 criterion is the organising principle of power system operation: the
 * system must survive the loss of any single element. Control room staff do
 * not primarily watch what IS happening — they watch what WOULD happen if the
 * largest in-feed disappeared in the next second.
 *
 * Surfacing this turns GridGuard from a reactive game into an anticipatory
 * one. "Corridor stress 58 %" tells a player nothing about whether they are
 * one trip away from losing the city; "Insecure — losing G-BASE-S would take
 * you to 3.8 Hz/s" tells them exactly that.
 */
import { NOMINAL_HZ } from './swing';

export type SecurityVerdict = 'Secure' | 'AtRisk' | 'Insecure';

export interface ReserveUnit {
  readonly id: string;
  readonly kind: string;
  readonly ratedMw: number;
  readonly outputMw: number;
  readonly online: boolean;
}

export interface ReserveAssessment {
  /** Total unloaded capacity on online units, MW. */
  readonly reserveMw: number;
  /** Output of the single largest online in-feed, MW. */
  readonly largestInfeedMw: number;
  readonly largestInfeedId: string | null;
  /** RoCoF that losing the largest in-feed would cause right now, Hz/s. */
  readonly projectedRocofHzPerS: number;
  readonly verdict: SecurityVerdict;
}

/** Reserve below this multiple of the largest in-feed is merely at risk. */
const AT_RISK_RATIO = 1.0;
const SECURE_RATIO = 1.2;

/**
 * Assess whether the system would survive losing its largest single in-feed.
 * Pure; reads a snapshot and computes nothing that persists.
 */
export function assessReserve(
  units: readonly ReserveUnit[],
  demandMw: number,
  inertiaMwS: number,
): ReserveAssessment {
  let reserveMw = 0;
  let largestInfeedMw = 0;
  let largestInfeedId: string | null = null;

  for (const unit of units) {
    if (!unit.online) continue;
    reserveMw += Math.max(0, unit.ratedMw - unit.outputMw);
    if (unit.outputMw > largestInfeedMw) {
      largestInfeedMw = unit.outputMw;
      largestInfeedId = unit.id;
    }
  }

  const projectedRocofHzPerS =
    inertiaMwS > 0 ? (NOMINAL_HZ * largestInfeedMw) / (2 * inertiaMwS) : Infinity;

  let verdict: SecurityVerdict;
  if (largestInfeedMw === 0) {
    verdict = 'Secure';
  } else if (reserveMw >= largestInfeedMw * SECURE_RATIO) {
    verdict = 'Secure';
  } else if (reserveMw >= largestInfeedMw * AT_RISK_RATIO) {
    verdict = 'AtRisk';
  } else {
    verdict = 'Insecure';
  }

  void demandMw; // reserved for the line-overload screen in workstream 3

  return {
    reserveMw,
    largestInfeedMw,
    largestInfeedId,
    projectedRocofHzPerS,
    verdict,
  };
}
