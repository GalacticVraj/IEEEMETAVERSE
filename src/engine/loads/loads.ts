import { asMegaWatts, asSystemId } from '@app-types';
import type { LoadId, MegaWatts, SystemId, ZoneId } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createToken } from '@core';
import type { SimulationSystem, SnapshotableSystem, SystemContext, Token } from '@core';

import type { GridTopology } from '../model/grid';
import type { WeatherState } from '../weather/weather';

export interface ZoneDemand {
  readonly zone: ZoneId;
  readonly demand: MegaWatts;
}

/** Computes electricity demand per zone under current conditions. */
export interface ILoadModel extends SimulationSystem {
  demand(topology: GridTopology, weather: WeatherState): readonly ZoneDemand[];
  totalDemand(): MegaWatts;
  shedLoad(id: LoadId, fraction: number): void;
  getShedFraction(id: LoadId): number;
  resetShedding(): void;
  getLoadDemand(id: LoadId): MegaWatts;
}

export const LOAD_MODEL: Token<ILoadModel> = createToken('LoadModel');

/**
 * Concrete Meridian Bay load model.
 */
export class MeridianBayLoadModel implements ILoadModel, SnapshotableSystem {
  public readonly id: SystemId = asSystemId('load-model');
  private context!: SystemContext;
  private shedFractions = new Map<LoadId, number>();
  private lastDemands = new Map<LoadId, MegaWatts>();
  private currentZoneDemands: readonly ZoneDemand[] = [];

  public init(context: SystemContext): void {
    this.context = context;
    this.reset();
  }

  public step(): void {
    // Nothing tick-specific other than what dispatch/demand calls do.
  }

  public reset(): void {
    this.shedFractions.clear();
    this.lastDemands.clear();
    this.currentZoneDemands = [];
  }

  public dispose(): void {
    this.shedFractions.clear();
    this.lastDemands.clear();
  }

  public captureState(): unknown {
    return {
      shedFractions: Array.from(this.shedFractions.entries()),
    };
  }

  public restoreState(state: unknown): void {
    const s = state as { shedFractions: [LoadId, number][] };
    this.shedFractions = new Map(s.shedFractions);
  }

  public shedLoad(id: LoadId, fraction: number): void {
    const clamped = Math.max(0, Math.min(1, fraction));
    this.shedFractions.set(id, clamped);
  }

  public getShedFraction(id: LoadId): number {
    return this.shedFractions.get(id) ?? 0;
  }

  public resetShedding(): void {
    this.shedFractions.clear();
  }

  public getLoadDemand(id: LoadId): MegaWatts {
    return this.lastDemands.get(id) ?? (0 as MegaWatts);
  }

  public demand(topology: GridTopology, weather: WeatherState): readonly ZoneDemand[] {
    const zoneMap = new Map<ZoneId, number>();
    for (const zone of topology.zones) {
      zoneMap.set(zone.id, 0);
    }

    const temp = weather.temperature;
    // Temperature multiplier for weather-sensitive loads:
    // Cool heating below 15C, air-con cooling above 25C.
    let residentialMult = 1.0;
    if (temp > 25) {
      residentialMult = 1.0 + 0.05 * (temp - 25);
    } else if (temp < 15) {
      residentialMult = 1.0 + 0.03 * (15 - temp);
    }

    for (const load of topology.loads) {
      // Determine base weather multiplier
      let mult = 1.0;
      if (load.id.includes('-RN-') || load.id.includes('-RS-')) {
        mult = residentialMult;
      } else if (load.id.includes('-COM') || load.id.includes('-RET') || load.id.includes('-MIX')) {
        // Commercial is slightly sensitive to cooling only
        mult = temp > 25 ? 1.0 + 0.04 * (temp - 25) : 1.0;
      }

      // Hospital and water treatment are critical and flat
      if (load.critical) {
        mult = 1.0;
      }

      const nominal = load.nominalDemand;
      const weatherAdjusted = nominal * mult;

      // Apply shedding
      const shedFrac = load.critical ? 0 : (this.shedFractions.get(load.id) ?? 0);
      const actualDemand = asMegaWatts(Math.max(0, weatherAdjusted * (1 - shedFrac)));

      this.lastDemands.set(load.id, actualDemand);

      const zoneSum = zoneMap.get(load.zone) ?? 0;
      zoneMap.set(load.zone, zoneSum + actualDemand);
    }

    const result: ZoneDemand[] = [];
    for (const [zoneId, demandMw] of zoneMap.entries()) {
      result.push({ zone: zoneId, demand: asMegaWatts(demandMw) });
      // Emit LoadChanged when aggregate demand changes
      this.context.events.emit(GRID_EVENT.LoadChanged, {
        zone: zoneId,
        demand: asMegaWatts(demandMw),
      });
    }

    this.currentZoneDemands = result;
    return result;
  }

  public totalDemand(): MegaWatts {
    let sum = 0;
    for (const demand of this.currentZoneDemands) {
      sum += demand.demand;
    }
    return asMegaWatts(sum);
  }
}

