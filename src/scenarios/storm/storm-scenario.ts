import { Severity, asGeneratorId, asLineId, asScenarioId } from '@app-types';
import type { TickContext } from '@core';
import { STORM_ARC } from '@engine';

import type {
  ICrisisScenario,
  ScenarioContext,
  ScenarioFaultApi,
  ScenarioMetadata,
} from '../crisis-scenario';
import { at } from '../shift-clock';

/**
 * **Coastal Storm** — a deep low-pressure system batters Meridian Bay.
 *
 * Re-choreographed onto the real 1,800-tick shift. The previous timeline fired
 * at ticks 30 / 50 / 80 — T+0:03, T+0:05 and T+0:08 — so the entire storm was
 * finished eight seconds into a three-minute run and the remaining 2:52 was a
 * quiet grid. It now runs the length of the shift:
 *
 * - T+0:00–0:30 · The storm is already on the coast. High wind means the farm
 *   is running near rated — the grid looks comfortable, and it is, for now.
 * - T+0:30 · Lightning trips GN1-DT1, the northern renewable export. Downtown
 *   now leans on GS1-DT1 alone.
 * - T+1:10 · Salt-spray flashover opens HB1-HB2. The harbor starts to isolate.
 * - T+1:50 · The wind farm hits its overspeed limit and shuts down — the
 *   cruellest moment in the arc, because the same wind that was carrying the
 *   grid is what takes the turbines away.
 * - T+2:20 · RS3-HB1 flashes over. The harbor is now on a single path.
 *
 * The overspeed trip is the lesson: high wind is not free capacity, it is
 * capacity with a cliff at the end of it.
 */
export class StormScenario implements ICrisisScenario {
  public readonly metadata: ScenarioMetadata = {
    id: asScenarioId('storm'),
    name: 'Coastal Storm',
    summary:
      'A violent coastal storm trips critical transmission lines via lightning and flashover, ' +
      'while the wind farm ultimately shuts down on overspeed, fragmenting the grid.',
    difficulty: Severity.Critical,
  };

  private faults!: ScenarioFaultApi;
  private renewableLineTripped = false;
  private harborLineTripped = false;
  private windTripped = false;
  private harborSecondTripped = false;

  public setup(context: ScenarioContext): void {
    this.faults = context.faults;
    // Without this the "storm" ran at wind 0.3, which `classifyKind` reads as
    // Clear — so the lightning effects (gated on weatherKind === 'Storm')
    // could never fire and the storm scenario had no storm in it.
    context.weather.setArc(STORM_ARC);
    this.renewableLineTripped = false;
    this.harborLineTripped = false;
    this.windTripped = false;
    this.harborSecondTripped = false;
  }

  public onTick(context: TickContext): void {
    const { tick } = context;

    // T+0:30 — lightning strike on the northern renewable export.
    if (tick === at(0, 30) && !this.renewableLineTripped) {
      this.faults.commandOpenLine(asLineId('GN1-DT1'));
      this.renewableLineTripped = true;
    }

    // T+1:10 — salt-spray flashover; the harbor begins to isolate.
    if (tick === at(1, 10) && !this.harborLineTripped) {
      this.faults.commandOpenLine(asLineId('HB1-HB2'));
      this.harborLineTripped = true;
    }

    // T+1:50 — overspeed protection takes the wind farm off. The wind that was
    // carrying the grid is the wind that removes it.
    if (tick === at(1, 50) && !this.windTripped) {
      this.faults.tripGenerator(asGeneratorId('G-WIND'));
      this.windTripped = true;
    }

    // T+2:20 — the second harbor path goes. Nothing is redundant now.
    if (tick === at(2, 20) && !this.harborSecondTripped) {
      this.faults.commandOpenLine(asLineId('RS3-HB1'));
      this.harborSecondTripped = true;
    }
  }

  public teardown(): void {
    if (this.windTripped) {
      this.faults.untripGenerator(asGeneratorId('G-WIND'));
    }
    // Line re-closures are handled by the restoration controller.
  }
}
