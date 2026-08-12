import { asMegaWatts, asSystemId } from '@app-types';
import type { GeneratorId, MegaWatts, SystemId } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createToken } from '@core';
import type {
  GridEventMap,
  SimulationSystem,
  SnapshotableSystem,
  SystemContext,
  Token,
  TypedEventBus,
} from '@core';

import type { GridTopology } from '../model/grid';
import type { WeatherState } from '../weather/weather';

export interface GenerationDispatch {
  readonly generator: GeneratorId;
  readonly output: MegaWatts;
}

/** Computes how much each generator is producing under current conditions. */
/**
 * Governor droop, per unit. 5 % means a 5 % frequency change commands 100 %
 * output change — the standard setting for interconnected operation.
 */
const DROOP_R = 0.05;
const NOMINAL_HZ = 60;
/** A governor can open a valve several times faster than a dispatch ramp. */
const MAX_GOVERNOR_URGENCY = 4;
/** Per-tick ramp headroom in MW, by generator kind. */
const RAMP_LIMITS: Readonly<Record<string, number>> = {
  Peaker: 5,
  Import: 10,
  Storage: 20,
};

export interface IGenerationModel extends SimulationSystem {
  dispatch(
    topology: GridTopology,
    weather: WeatherState,
    targetDemand?: MegaWatts,
    frequencyHz?: number,
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
  /**
   * False until the first dispatch after a reset has established the operating
   * point. An operator inherits a grid that is ALREADY RUNNING — starting every
   * ramp-limited unit at 0 MW created a phantom deficit of several hundred MW
   * on tick 0, which under real frequency dynamics crashed the grid and fired
   * every UFLS stage before the player could act.
   */
  private primed = false;

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
    this.primed = false;
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
    frequencyHz: number = NOMINAL_HZ,
  ): readonly GenerationDispatch[] {
    const results: GenerationDispatch[] = [];
    let remainingDemand: number = targetDemand;

    // 1. Calculate maximum available capacity for each generator under current weather
    const availabilities = new Map<GeneratorId, number>();
    for (const gen of topology.generators) {
      if (this.tripped.has(gen.id)) {
        availabilities.set(gen.id, 0);
        continue;
      }

      let avail: number = gen.capacity;
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

    // 3. Apply ramp rate limits from previous outputs.
    //
    // These limits ARE the primary frequency response: a governor senses
    // falling frequency and opens the valve, and how fast it can do so is
    // exactly what a ramp limit expresses. Frequency deviation therefore
    // scales the limit rather than injecting a separate power term — adding
    // a parallel droop injection on top of a dispatch that already chases
    // demand would double-count primary response.
    //
    // Baseload cannot ramp meaningfully; renewables are weather-limited;
    // neither responds to frequency.
    const deviationHz = NOMINAL_HZ - frequencyHz;
    const urgency =
      deviationHz <= 0
        ? 1
        : Math.min(MAX_GOVERNOR_URGENCY, 1 + deviationHz / (DROOP_R * NOMINAL_HZ) / 0.1);

    for (const gen of topology.generators) {
      const target = plannedDispatch.get(gen.id) ?? 0;
      const prev = this.currentOutputs.get(gen.id) ?? 0;

      let actual = target;
      if (this.tripped.has(gen.id)) {
        actual = 0;
      } else if (!this.primed) {
        // First dispatch after a reset: adopt the planned operating point
        // directly. Ramp limits describe how fast a running plant can CHANGE
        // output, not how it came to be running in the first place.
        actual = target;
      } else {
        const baseLimit = RAMP_LIMITS[gen.kind as string];
        if (baseLimit !== undefined) {
          // Only an increase is urgent — a governor does not close a valve
          // faster because frequency is low.
          const diff = target - prev;
          const limit = diff > 0 ? baseLimit * urgency : baseLimit;
          if (Math.abs(diff) > limit) {
            actual = prev + Math.sign(diff) * limit;
          }
        }
      }

      // Clamp actual between 0 and maximum available
      const maxAvail = availabilities.get(gen.id) ?? 0;
      actual = Math.max(0, Math.min(maxAvail, actual));

      this.currentOutputs.set(gen.id, asMegaWatts(actual));
      results.push({ generator: gen.id, output: asMegaWatts(actual) });

      // Emit GenerationChanged when output changes
      (this.context.events as unknown as TypedEventBus<GridEventMap>).emit(
        GRID_EVENT.GenerationChanged,
        {
          generator: gen.id,
          output: asMegaWatts(actual),
        },
      );
    }

    // The operating point is established; ramp limits govern from here.
    this.primed = true;

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
