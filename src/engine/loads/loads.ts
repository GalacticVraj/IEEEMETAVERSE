import { asMegaWatts, asSystemId } from '@app-types';
import type { LoadId, MegaWatts, SystemId, ZoneId } from '@app-types';
import { createToken } from '@core';
import type { SimulationSystem, SnapshotableSystem, SystemContext, Token } from '@core';

import type { BuildingApplianceState, GridTopology } from '../model/grid';
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
  getBuildingAppliances(): BuildingApplianceState[];
  toggleAppliance(buildingId: string, applianceId: string, isOn: boolean): void;
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
  private buildings: BuildingApplianceState[] = [];

  /**
   * Appliance blocks are DISTRICT AGGREGATES, not single devices: each city
   * building stands for a whole block, so "Air Conditioning" on one house
   * model is the AC of ~1,000 homes. Wattage is in aggregate kW (demand()
   * divides by 1,000 → MW).
   *
   * CALIBRATION (winner-mode C1): total flexible appliance load ≈ 186 MW on
   * top of the ~895 MW topology base → ~1,080 MW nominal against 1,150 MW of
   * capacity. A heatwave pushes demand past capacity by ~60–130 MW — exactly
   * the gap the operator's levers (~165 MW of flexible load) can close. The
   * grid CAN balance, but only if the operator acts.
   */
  private generateInitialAppliances(topology: GridTopology) {
    this.buildings = [];
    for (const zone of topology.zones) {
      for (const buildingId of zone.buildingIds) {
        const appliances = [];
        if (buildingId.includes('House')) {
          // Residential block ≈ 3.6 MW flexible (16 blocks ≈ 57.6 MW)
          appliances.push({ id: 'ac', name: 'Air Conditioning (block)', category: 'ac', wattage: 1500, isOn: true });
          appliances.push({ id: 'ev', name: 'EV Charging (block)', category: 'ev_charger', wattage: 1200, isOn: true });
          appliances.push({ id: 'heater', name: 'Water Heating (block)', category: 'water_heater', wattage: 500, isOn: true });
          appliances.push({ id: 'lights', name: 'Lighting (block)', category: 'lighting', wattage: 150, isOn: true });
          appliances.push({ id: 'fridge', name: 'Refrigeration (block)', category: 'refrigeration', wattage: 250, isOn: true });
        } else if (buildingId.includes('Corp') || buildingId.includes('Hosp') || buildingId.includes('Sch') || buildingId.includes('Term')) {
          // Commercial campus ≈ 8 MW flexible (9 campuses ≈ 72 MW)
          appliances.push({ id: 'ac', name: 'HVAC System', category: 'ac', wattage: 4000, isOn: true });
          appliances.push({ id: 'lights', name: 'Commercial Lighting', category: 'lighting', wattage: 2500, isOn: true });
          appliances.push({ id: 'servers', name: 'Servers/Computers', category: 'lighting', wattage: 1500, isOn: true });
        } else {
          // Industrial / station site ≈ 8 MW flexible (7 sites ≈ 56 MW)
          appliances.push({ id: 'machinery', name: 'Heavy Machinery', category: 'lighting', wattage: 6000, isOn: true });
          appliances.push({ id: 'ac', name: 'HVAC', category: 'ac', wattage: 2000, isOn: true });
        }
        this.buildings.push({ buildingId, appliances: appliances as any });
      }
    }
  }

  public init(context: SystemContext): void {
    this.context = context;
    this.reset();
  }

  public initializeTopology(topology: GridTopology): void {
    this.generateInitialAppliances(topology);
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
      buildings: this.buildings,
    };
  }

  public restoreState(state: unknown): void {
    const s = state as { shedFractions: [LoadId, number][], buildings: BuildingApplianceState[] };
    this.shedFractions = new Map(s.shedFractions);
    this.buildings = s.buildings || [];
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

  public getBuildingAppliances(): BuildingApplianceState[] {
    return this.buildings;
  }

  public toggleAppliance(buildingId: string, applianceId: string, isOn: boolean): void {
    const b = this.buildings.find(x => x.buildingId === buildingId);
    if (b) {
      const a = b.appliances.find(x => x.id === applianceId);
      if (a) {
        a.isOn = isOn;
      }
    }
  }

  public demand(topology: GridTopology, weather: WeatherState): readonly ZoneDemand[] {
    const zoneMap = new Map<ZoneId, number>();
    for (const zone of topology.zones) {
      zoneMap.set(zone.id, 0);
    }

    const temp = weather.temperature;
    // Temperature multiplier for weather-sensitive loads. Real grids see
    // roughly 1–2 % demand growth per °C above the cooling threshold — a
    // 41 °C heatwave lifts residential demand ~32 %, pushing the system just
    // past capacity so operator action genuinely decides the outcome.
    let residentialMult = 1.0;
    if (temp > 25) {
      residentialMult = 1.0 + 0.02 * (temp - 25);
    } else if (temp < 15) {
      residentialMult = 1.0 + 0.015 * (15 - temp);
    }

    for (const load of topology.loads) {
      // Determine base weather multiplier
      let mult = 1.0;
      if (load.id.includes('-RN-') || load.id.includes('-RS-')) {
        mult = residentialMult;
      } else if (load.id.includes('-COM') || load.id.includes('-RET') || load.id.includes('-MIX')) {
        // Commercial is slightly sensitive to cooling only
        mult = temp > 25 ? 1.0 + 0.015 * (temp - 25) : 1.0;
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
    for (const zone of topology.zones) {
      const baseZoneDemand = zoneMap.get(zone.id) ?? 0;
      
      // Calculate appliance-level load for this zone (in MW)
      const applianceLoadKw = this.buildings
        .filter(b => zone.buildingIds.includes(b.buildingId))
        .flatMap(b => b.appliances)
        .filter(a => a.isOn)
        .reduce((sum, a) => sum + a.wattage, 0);
      const applianceLoadMw = applianceLoadKw / 1000;

      // The zone demand is a combination of the base load nodes + detailed appliance loads
      // For simplicity in this demo, we can just use the appliance load as an additive term
      // or replace a portion. We'll add it to baseZoneDemand for now.
      const totalMw = baseZoneDemand + applianceLoadMw;

      result.push({ zone: zone.id, demand: asMegaWatts(totalMw) });
      (this.context.events as any).emit('LoadChanged', {
        zone: zone.id,
        demand: asMegaWatts(totalMw),
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

