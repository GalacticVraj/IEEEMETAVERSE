import { asHertz, asMegaWatts, asPerUnit, asSystemId } from '@app-types';
import type { Hertz, LineId, MegaWatts, PerUnit, SystemId } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createToken, isSnapshotable } from '@core';
import type { SimulationSystem, SnapshotableSystem, SystemContext, TickContext, Token } from '@core';

import type { ICascadeEngine } from './cascade/cascade';
import type { IDirector } from './director/director';
import type { IGenerationModel } from './generation/generation';
import type { ElectricalGraph } from './graph';
import type { ILoadModel } from './loads/loads';
import type { GridState, LineFlow, ZoneStatus } from './model/grid';
import { solveDcPowerFlow } from './powerflow/dc-power-flow';
import type { ProtectionEngine } from './protection/protection-engine';
import type { IRestorationController } from './restoration/restoration';
import type { ITopologyService } from './topology/topology';
import type { IWeatherModel } from './weather/weather';

/**
 * The Simulation Engine facade — System A's single entry point and the one
 * `SimulationSystem` registered with the kernel. It owns the authoritative
 * `GridState` and, each tick, orchestrates its subsystems in physical order.
 */
export interface ISimulationEngine extends SimulationSystem {
  /** Authoritative snapshot of the live grid. */
  getState(): GridState;
}

export const SIMULATION_ENGINE: Token<ISimulationEngine> = createToken('SimulationEngine');

/**
 * Real GridSimulationEngine orchestrator.
 */
export class GridSimulationEngine implements ISimulationEngine, SnapshotableSystem {
  public readonly id: SystemId = asSystemId('simulation-engine');
  private context!: SystemContext;
  private state!: GridState;

  public constructor(
    private readonly graph: ElectricalGraph,
    private readonly topologyService: ITopologyService,
    private readonly weather: IWeatherModel,
    private readonly generation: IGenerationModel,
    private readonly loads: ILoadModel,
    private readonly protection: ProtectionEngine,
    private readonly cascade: ICascadeEngine,
    private readonly restoration: IRestorationController,
    private readonly director: IDirector,
  ) {
    this._initializeState();
  }

  public init(context: SystemContext): void {
    this.context = context;
    this.weather.init(context);
    this.generation.init(context);
    this.loads.init(context);
    this.cascade.init(context);
    this.restoration.init(context);
    this.protection.register(this.graph);

    this.reset();
  }

  public step(context: TickContext): void {
    // 1. Weather update
    const weatherState = this.weather.advance(context);

    // 2. Load model updates (target demands)
    const topology = this.topologyService.get();
    const zoneDemands = this.loads.demand(topology, weatherState);
    const totalDemand = this.loads.totalDemand();

    // 3. Generation dispatch to meet total demand
    this.generation.dispatch(topology, weatherState, totalDemand);
    const totalGen = this.generation.totalOutput();

    // 4. Power flow solve
    // Sync generator and load injections into the graph first
    this.graph.mutate((tx) => {
      for (const gen of topology.generators) {
        if (this.graph.getGenerator(gen.id)) {
          const actualOutput = this.generation.getGeneratorOutput(gen.id);
          tx.updateMetadata(gen.id, { generationMw: actualOutput });
        }
      }
      for (const load of topology.loads) {
        if (this.graph.getLoad(load.id)) {
          const actualDemand = this.loads.getLoadDemand(load.id);
          tx.updateMetadata(load.id, { demandMw: actualDemand });
        }
      }
    });

    const pfResult = solveDcPowerFlow(this.graph, {
      events: this.context.events as any,
    });

    // 5. Protection evaluation
    const protectionResult = this.protection.evaluate({
      graph: this.graph,
      flows: pfResult.flows,
      tick: context.tick,
      timestepS: context.timestep,
    });

    const lineFlows: LineFlow[] = pfResult.flows.map((f) => {
      const lineId = f.line;
      const b = this.protection.breakerFor(lineId);
      const loading = f.loading;

      let state: any = 'Nominal';
      if (b) {
        if (b.phase === 'Opening') state = 'Tripping';
        else if (b.phase === 'Open') state = 'Tripped';
        else if (b.phase === 'Closing') state = 'Cooling';
        else if (loading >= 1.0) state = 'Overloaded';
      }

      return {
        line: lineId,
        flow: asMegaWatts(f.flowMw),
        loading: asPerUnit(loading),
        state,
      };
    });

    this.cascade.propagate(lineFlows);

    // 7. Zone status & blackout calculations
    const zoneStatuses: ZoneStatus[] = [];
    const poweredBuses = new Set<string>();

    for (const island of pfResult.islands) {
      if (island.totalGenerationMw > 0 && island.converged) {
        for (const bus of island.buses) {
          poweredBuses.add(bus);
        }
      }
    }

    for (const zone of topology.zones) {
      const zoneNodes = topology.nodes.filter((n) => n.zone === zone.id);
      const poweredNodes = zoneNodes.filter((n) => poweredBuses.has(n.id));

      let zoneState: any = 'Powered';
      if (poweredNodes.length === 0) {
        zoneState = 'Blackout';
      } else if (poweredNodes.length < zoneNodes.length) {
        zoneState = 'Degraded';
      }

      // Sum served/unserved load
      let served = 0;
      let unserved = 0;

      const zoneLoads = topology.loads.filter((l) => l.zone === zone.id);
      for (const load of zoneLoads) {
        const demand = this.loads.getLoadDemand(load.id);
        if (poweredBuses.has(load.node)) {
          served += demand;
        } else {
          unserved += demand;
        }
      }

      zoneStatuses.push({
        zone: zone.id,
        state: zoneState,
        servedLoad: asMegaWatts(served),
        unservedLoad: asMegaWatts(unserved),
      });

      if (zoneState === 'Blackout' && unserved > 0) {
        this.context.events.emit(GRID_EVENT.ZoneBlackout, {
          zone: zone.id,
          unservedLoad: asMegaWatts(unserved),
        });
      } else if (zoneState === 'Powered') {
        this.context.events.emit(GRID_EVENT.ZonePowered, {
          zone: zone.id,
        });
      }
    }

    // 8. Restoration planning
    // Clamped frequency: 60.0 + 0.005 * (generation - load) Hz
    const freq = asHertz(Math.max(55, Math.min(65, 60.0 + 0.005 * (totalGen - totalDemand))));
    this.state = {
      frequency: freq,
      lines: lineFlows,
      zones: zoneStatuses,
      totalGeneration: totalGen,
      totalLoad: totalDemand,
    };

    this.restoration.plan(this.state);

    // 9. Tension pacing / Director
    this.director.pace(context);

    // Emit simulation tick completion
    this.context.events.emit(GRID_EVENT.SimulationTick, {
      tick: context.tick,
      simTime: context.time,
    });
  }

  public reset(): void {
    this.weather.reset();
    this.generation.reset();
    this.loads.reset();
    this.cascade.reset();
    this.restoration.reset();
    this._initializeState();
  }

  public dispose(): void {
    this.weather.dispose();
    this.generation.dispose();
    this.loads.dispose();
    this.cascade.dispose();
    this.restoration.dispose();
  }

  public getState(): GridState {
    return this.state;
  }

  public captureState(): unknown {
    return {
      weather: isSnapshotable(this.weather) ? this.weather.captureState() : null,
      generation: isSnapshotable(this.generation) ? this.generation.captureState() : null,
      loads: isSnapshotable(this.loads) ? this.loads.captureState() : null,
      cascade: isSnapshotable(this.cascade) ? this.cascade.captureState() : null,
      restoration: isSnapshotable(this.restoration) ? this.restoration.captureState() : null,
      state: this.state,
    };
  }

  public restoreState(state: unknown): void {
    const s = state as {
      weather: unknown;
      generation: unknown;
      loads: unknown;
      cascade: unknown;
      restoration: unknown;
      state: GridState;
    };
    if (isSnapshotable(this.weather)) this.weather.restoreState(s.weather);
    if (isSnapshotable(this.generation)) this.generation.restoreState(s.generation);
    if (isSnapshotable(this.loads)) this.loads.restoreState(s.loads);
    if (isSnapshotable(this.cascade)) this.cascade.restoreState(s.cascade);
    if (isSnapshotable(this.restoration)) this.restoration.restoreState(s.restoration);
    this.state = s.state;
  }

  private _initializeState(): void {
    this.state = {
      frequency: asHertz(60),
      lines: [],
      zones: [],
      totalGeneration: asMegaWatts(0),
      totalLoad: asMegaWatts(0),
    };
  }
}
