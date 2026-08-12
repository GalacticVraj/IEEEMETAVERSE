/**
 * city-response.ts — derives what the 3D city should SHOW from what the
 * simulation actually COMPUTED.
 *
 * This module exists because the render layer previously inferred its state by
 * substring-matching the operator decision log:
 *
 *     const batteryActive = decisionLog.some((d) => d.action.type.includes('battery'));
 *
 * That was wrong twice over. No action id contains "battery" (or "solar", or
 * "hospital"), so those visuals could never switch on; and `decisionLog.some`
 * is monotonic, so the ones that DID match latched on forever — a district shed
 * once at T+0:30 stayed dim for the rest of the shift even after restoration.
 *
 * Everything here is derived from live `ZoneStatus` / `GeneratorStatus`
 * projections instead, so the city brightens again when load comes back and a
 * plant only reads as tripped when that plant really tripped.
 */
import type { GeneratorStatus, ZoneStatus } from '@engine/model/grid';
import { MERIDIAN_BAY_TOPOLOGY } from '@engine/topology/meridian-bay';

/**
 * City visual asset id → the topology generator it depicts.
 *
 * The render layer names things for the player ("GEN-Thermal1"); the topology
 * names them for the solver ("G-BASE-S"). This table is the ONLY place that
 * correspondence is written down — a test asserts every target really exists.
 */
export const CITY_ASSET_GENERATOR: Readonly<Record<string, string>> = {
  'GEN-Thermal1': 'G-BASE-S',
  'GEN-Wind1': 'G-WIND',
  'GEN-Wind2': 'G-WIND',
  'RN-Solar': 'G-SOLAR',
  'BESS-1': 'G-BATT-DT',
  'BESS-2': 'G-BATT-DT',
};

/** Downtown is the hospital's zone — its stress is what makes priority legible. */
const HOSPITAL_ZONE = 'DT';

export interface CityResponse {
  /** Zones with no energised bus at all. */
  readonly darkZones: ReadonlySet<string>;
  /** Zone id → served ÷ nominal demand, clamped to 0..1. */
  readonly zoneLoadFactor: Readonly<Record<string, number>>;
  /** City asset id → its generator's output ÷ capacity, clamped to 0..1. */
  readonly assetOutputFactor: Readonly<Record<string, number>>;
  /** City asset ids whose backing generator is tripped. */
  readonly trippedAssets: ReadonlySet<string>;
  /** True while downtown is not fully powered and the hospital is holding on. */
  readonly hospitalPrioritized: boolean;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** Signature resolution: 20 buckets ⇒ a 5% change is the smallest that re-renders. */
const SIGNATURE_BUCKETS = 20;

/** Nominal demand per zone, summed from the static topology load table. */
export function zoneNominalDemand(): Readonly<Record<string, number>> {
  const totals: Record<string, number> = {};
  for (const load of MERIDIAN_BAY_TOPOLOGY.loads) {
    const zoneId = load.zone as string;
    totals[zoneId] = (totals[zoneId] ?? 0) + (load.nominalDemand as number);
  }
  return totals;
}

/**
 * Quantised fingerprint of everything the city renders from.
 *
 * `useGridStore` publishes fresh `zones` / `generators` arrays on every tick
 * (10 Hz), so a component selecting those arrays re-renders — and reconciles
 * roughly fifty building components — ten times a second even when nothing
 * visibly changed. Selecting this string instead re-renders only when the
 * picture would actually differ.
 */
export function cityResponseSignature(
  zones: readonly ZoneStatus[],
  generators: readonly GeneratorStatus[],
): string {
  const nominal = zoneNominalDemand();
  const parts: string[] = [];

  for (const status of zones) {
    const zoneId = status.zone as string;
    const base = nominal[zoneId] ?? 0;
    const factor = base > 0 ? clamp01((status.servedLoad as number) / base) : 1;
    // 5% buckets — finer than that is below the threshold of a visible change.
    parts.push(`${zoneId}:${status.state}:${Math.round(factor * SIGNATURE_BUCKETS)}`);
  }

  for (const generator of generators) {
    const capacity = generator.capacityMw as number;
    const factor = capacity > 0 ? clamp01((generator.outputMw as number) / capacity) : 0;
    parts.push(
      `${generator.id as string}:${generator.tripped ? 'T' : 'R'}:${Math.round(factor * SIGNATURE_BUCKETS)}`,
    );
  }

  return parts.join('|');
}

export function deriveCityResponse(
  zones: readonly ZoneStatus[],
  generators: readonly GeneratorStatus[],
  nominalDemandByZone: Readonly<Record<string, number>>,
): CityResponse {
  const darkZones = new Set<string>();
  const zoneLoadFactor: Record<string, number> = {};

  for (const status of zones) {
    const zoneId = status.zone as string;
    if (status.state === 'Blackout') {
      darkZones.add(zoneId);
      zoneLoadFactor[zoneId] = 0;
      continue;
    }
    const nominal = nominalDemandByZone[zoneId] ?? 0;
    zoneLoadFactor[zoneId] = nominal > 0 ? clamp01((status.servedLoad as number) / nominal) : 1;
  }

  const byGeneratorId = new Map<string, GeneratorStatus>();
  for (const generator of generators) byGeneratorId.set(generator.id, generator);

  const assetOutputFactor: Record<string, number> = {};
  const trippedAssets = new Set<string>();

  for (const [assetId, generatorId] of Object.entries(CITY_ASSET_GENERATOR)) {
    const live = byGeneratorId.get(generatorId);
    if (live === undefined) {
      assetOutputFactor[assetId] = 0;
      continue;
    }
    const capacity = live.capacityMw as number;
    assetOutputFactor[assetId] = capacity > 0 ? clamp01((live.outputMw as number) / capacity) : 0;
    if (live.tripped) trippedAssets.add(assetId);
  }

  const downtown = zones.find((z) => (z.zone as string) === HOSPITAL_ZONE);
  const hospitalPrioritized = downtown !== undefined && downtown.state !== 'Powered';

  return { darkZones, zoneLoadFactor, assetOutputFactor, trippedAssets, hospitalPrioritized };
}
