import { asMegaWatts, asSystemId } from '@app-types';
import type { GeneratorId, MegaWatts, SystemId } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createToken } from '@core';
import type { GridEventMap, SimulationSystem, SnapshotableSystem, SystemContext, Token, TypedEventBus } from '@core';

import type { GridTopology } from '../model/grid';
import type { WeatherState } from '../weather/weather';

export interface GenerationDispatch {
  readonly generator: GeneratorId;
  readonly output: MegaWatts;
}

/** Computes how much each generator is producing under current conditions. */
export interface IGenerationModel extends SimulationSystem {
  dispatch(
    topology: GridTopology,
    weather: WeatherState,
    targetDemand?: MegaWatts,
  ): readonly GenerationDispatch[];
  totalOutput(): MegaWatts;
  tripGenerator(id: GeneratorId): void;
  untripGenerator(id: GeneratorId): void;
  isTripped(id: GeneratorId): boolean;
  resetTrips(): void;
  getGeneratorOutput(id: GeneratorId): MegaWatts;
}

export const GENERATION_MODEL: Token<IGenerationModel> = createToken('GenerationModel');

/**
 * Concrete Meridian Bay generation model.
 */
export class MeridianBayGenerationModel implements IGenerationModel, SnapshotableSystem {
  public readonly id: SystemId = asSystemId('generation-model');
  private context!: SystemContext;
  private tripped = new Set<GeneratorId>();
  private currentOutputs = new Map<GeneratorId, MegaWatts>();

  public init(context: SystemContext): void {
    this.context = context;
    this.reset();
  }

  public step(): void {
    // Nothing tick-specific
  }

  public reset(): void {
    this.tripped.clear();
    this.currentOutputs.clear();
  }

  public dispose(): void {
    this.tripped.clear();
    this.currentOutputs.clear();
  }

  public captureState(): unknown {
    return {
      tripped: Array.from(this.tripped),
      outputs: Array.from(this.currentOutputs.entries()),
    };
  }

  public restoreState(state: unknown): void {
    const s = state as { tripped: GeneratorId[]; outputs: [GeneratorId, number][] };
    this.tripped = new Set(s.tripped);
    this.currentOutputs = new Map(s.outputs.map(([id, mw]) => [id, asMegaWatts(mw)]));
  }

  public tripGenerator(id: GeneratorId): void {
    this.tripped.add(id);
  }

  public untripGenerator(id: GeneratorId): void {
    this.tripped.delete(id);
  }

  public isTripped(id: GeneratorId): boolean {
    return this.tripped.has(id);
  }

  public resetTrips(): void {
    this.tripped.clear();
  }

  public getGeneratorOutput(id: GeneratorId): MegaWatts {
    return this.currentOutputs.get(id) ?? (0 as MegaWatts);
  }

  public dispatch(
    topology: GridTopology,
    weather: WeatherState,
    targetDemand: MegaWatts = 895 as MegaWatts,
  ): readonly GenerationDispatch[] {
    const results: GenerationDispatch[] = [];
    let remainingDemand: number = targetDemand as number;

    // 1. Calculate maximum available capacity for each generator under current weather
    const availabilities = new Map<GeneratorId, number>();
    for (const gen of topology.generators) {
      if (this.tripped.has(gen.id)) {
        availabilities.set(gen.id, 0);
        continue;
      }

      let avail: number = gen.capacity as number;
      if (gen.kind === 'Solar') {
        avail = gen.capacity * weather.irradiance;
      } else if (gen.kind === 'Wind') {
        avail = gen.capacity * weather.wind;
      }
      availabilities.set(gen.id, avail);
    }

    // 2. Dispatch merit-order list
    // Merit Order Priority:
    // 1. Baseload (must run at full capacity unless tripped)
    // 2. Solar/Wind (must take as much as available)
    // 3. Import
    // 4. Peakers (HB -> IN -> S)
    // 5. Battery Storage
    const meritOrder = [
      { id: 'G-BASE-S', kind: 'Baseload' },
      { id: 'G-SOLAR', kind: 'Solar' },
      { id: 'G-WIND', kind: 'Wind' },
      { id: 'G-IMPORT', kind: 'Import' },
      { id: 'G-GAS-HB', kind: 'Peaker' },
      { id: 'G-PEAK-IN', kind: 'Peaker' },
      { id: 'G-PEAK-S', kind: 'Peaker' },
      { id: 'G-BATT-DT', kind: 'Storage' },
    ] as const;

    const plannedDispatch = new Map<GeneratorId, number>();

    // First pass: Baseload and Renewables (always run at available capacity if not tripped)
    for (const entry of meritOrder) {
      const gId = entry.id as GeneratorId;
      const avail = availabilities.get(gId) ?? 0;

      if (entry.kind === 'Baseload' || entry.kind === 'Solar' || entry.kind === 'Wind') {
        // Baseload and renewables are must-run
        plannedDispatch.set(gId, avail);
        remainingDemand -= avail;
      } else {
        plannedDispatch.set(gId, 0);
      }
    }

    // Second pass: Dispatch peakers, imports, storage to balance remaining demand
    if (remainingDemand > 0) {
      for (const entry of meritOrder) {
        if (entry.kind === 'Baseload' || entry.kind === 'Solar' || entry.kind === 'Wind') {
          continue;
        }

        const gId = entry.id as GeneratorId;
        const avail = availabilities.get(gId) ?? 0;
        const dispatch = Math.min(avail, remainingDemand);
        plannedDispatch.set(gId, dispatch);
        remainingDemand -= dispatch;

        if (remainingDemand <= 0) break;
      }
    }

    // 3. Apply ramp rate limits from previous outputs
    // Baseload: fixed (no ramp limit, but goes to 0 if tripped)
    // Renewables: no ramp limit
    // Peakers: ramp limit of 5 MW/tick
    // Import: ramp limit of 10 MW/tick
    // Battery: ramp limit of 20 MW/tick
    for (const gen of topology.generators) {
      const target = plannedDispatch.get(gen.id) ?? 0;
      const prev = this.currentOutputs.get(gen.id) ?? 0;

      let actual = target;
      if (this.tripped.has(gen.id)) {
        actual = 0;
      } else if (gen.kind === 'Peaker') {
        const diff = target - prev;
        const limit = 5;
        if (Math.abs(diff) > limit) {
          actual = prev + Math.sign(diff) * limit;
        }
      } else if (gen.kind === 'Import') {
        const diff = target - prev;
        const limit = 10;
        if (Math.abs(diff) > limit) {
          actual = prev + Math.sign(diff) * limit;
        }
      } else if (gen.kind === 'Storage') {
        const diff = target - prev;
        const limit = 20;
        if (Math.abs(diff) > limit) {
          actual = prev + Math.sign(diff) * limit;
        }
      }

      // Clamp actual between 0 and maximum available
      const maxAvail = availabilities.get(gen.id) ?? 0;
      actual = Math.max(0, Math.min(maxAvail, actual));

      this.currentOutputs.set(gen.id, asMegaWatts(actual));
      results.push({ generator: gen.id, output: asMegaWatts(actual) });

      // Emit GenerationChanged when output changes
      (this.context.events as unknown as TypedEventBus<GridEventMap>).emit(GRID_EVENT.GenerationChanged, {
        generator: gen.id,
        output: asMegaWatts(actual),
      });
    }

    return results;
  }

  public totalOutput(): MegaWatts {
    let sum = 0;
    for (const output of this.currentOutputs.values()) {
      sum += output;
    }
    return asMegaWatts(sum);
  }
}
