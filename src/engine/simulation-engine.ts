import {
  LineState,
  LineTripCause,
  ZoneState,
  asHertz,
  asLoadId,
  asMegaWatts,
  asPerUnit,
  asSystemId,
} from '@app-types';
import type { SystemId } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createToken, isSnapshotable } from '@core';
import type {
  DecisionCommittedPayload,
  GridEventMap,
  SimulationSystem,
  SnapshotableSystem,
  SystemContext,
  TickContext,
  Token,
  TypedEventBus,
} from '@core';

import type { ICascadeEngine } from './cascade/cascade';
import type { IDirector } from './director/director';
import type { IGenerationModel } from './generation/generation';
import { createFrequencyModel } from './frequency';
import type { FrequencyMachine, FrequencyModel } from './frequency';
import type { ElectricalGraph } from './graph';
import type { ILoadModel } from './loads/loads';
import type { GeneratorStatus, GridState, LineFlow, ZoneStatus } from './model/grid';
import { solveDcPowerFlow } from './powerflow/dc-power-flow';
import type { PowerFlowEventMap } from './powerflow/powerflow-events';
import type { ProtectionEngine } from './protection/protection-engine';
import type { IRestorationController } from './restoration/restoration';
import type { ITopologyService } from './topology/topology';
import type { IWeatherModel } from './weather/weather';

/** Per-unit loading at or above which a corridor reads as overloaded. */
const OVERLOAD_THRESHOLD_PU = 1.0;
/** Fraction of industrial load dropped by the controlled-shed action. */
const INDUSTRIAL_SHED_FRACTION = 0.3;
/** Fraction of harbor load dropped by the emergency-shed action. */
const HARBOR_SHED_FRACTION = 0.25;

/**
 * Lifecycle hooks that only SOME subsystems implement. Weather and the
 * director are pure enough not to need them, so the engine calls them
 * defensively - typed as optional rather than cast through `any`.
 */
interface OptionalLifecycle {
  init?: (context: SystemContext) => void;
  reset?: () => void;
  dispose?: () => void;
}

/** The load model additionally knows how to seed appliances from topology. */
interface TopologyAwareLoads {
  initializeTopology?: (topology: ReturnType<ITopologyService['get']>) => void;
}

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
  private readonly frequencyModel: FrequencyModel = createFrequencyModel();

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
    (this.weather as IWeatherModel & OptionalLifecycle).init?.(context);
    this.generation.init(context);
    this.loads.init(context);
    this.cascade.init(context);
    this.restoration.init(context);
    (this.director as IDirector & OptionalLifecycle).init?.(context);
    this.protection.register(this.graph);

    // Initialize detailed appliances based on topology
    (this.loads as ILoadModel & TopologyAwareLoads).initializeTopology?.(
      this.topologyService.get(),
    );

    this.domainEvents().on(GRID_EVENT.DecisionCommitted, (payload: DecisionCommittedPayload) => {
      const { optionIndex } = payload;
      const decisionId: string = payload.decisionId;
      const loads = this.loads;
      const zoneBuildings = (zoneId: string): string[] =>
        this.topologyService.get().zones.find((z) => z.id === zoneId)?.buildingIds ?? [];

      // Standing operator actions (op-*) — the console's action catalog.
      if (decisionId.includes('op-ac-residential')) {
        for (const b of [...zoneBuildings('RN'), ...zoneBuildings('RS')]) {
          loads.toggleAppliance(b, 'ac', false);
        }
      } else if (decisionId.includes('op-ev-pause')) {
        for (const zone of this.topologyService.get().zones) {
          for (const b of zone.buildingIds) loads.toggleAppliance(b, 'ev', false);
        }
      } else if (decisionId.includes('op-lights-commercial')) {
        for (const b of zoneBuildings('DT')) {
          loads.toggleAppliance(b, 'lights', false);
        }
      } else if (decisionId.includes('op-shed-industrial')) {
        loads.shedLoad(asLoadId('LD-IN-HVY'), INDUSTRIAL_SHED_FRACTION);
        loads.shedLoad(asLoadId('LD-IN-LGT'), INDUSTRIAL_SHED_FRACTION);
      } else if (decisionId.includes('op-shed-harbor')) {
        loads.shedLoad(asLoadId('LD-HB-IND'), HARBOR_SHED_FRACTION);
        loads.shedLoad(asLoadId('LD-HB-SHIP'), HARBOR_SHED_FRACTION);
      } else if (decisionId.includes('dec-overload')) {
        if (optionIndex === 0) {
          // Shed AC in Residential North
          const rnBuildings = zoneBuildings('RN');
          for (const b of rnBuildings) loads.toggleAppliance(b, 'ac', false);
        } else if (optionIndex === 1) {
          // Delay EV Charging in Downtown
          const dtBuildings = zoneBuildings('DT');
          for (const b of dtBuildings) loads.toggleAppliance(b, 'ev', false);
        } else if (optionIndex === 2) {
          // Shed all Commercial Lighting
          const bldgs = loads.getBuildingAppliances();
          for (const b of bldgs) {
            const hasComm = b.appliances.some((a) => a.name === 'Commercial Lighting');
            if (hasComm) loads.toggleAppliance(b.buildingId, 'lights', false);
          }
        }
      } else if (decisionId.includes('dec-cascade')) {
        if (optionIndex === 0) {
          // Shed Water Heaters in Residential South
          const rsBuildings = zoneBuildings('RS');
          for (const b of rsBuildings) loads.toggleAppliance(b, 'heater', false);
        } else if (optionIndex === 1) {
          // Shed Heavy Machinery in Industrial
          const inBuildings = zoneBuildings('IN');
          for (const b of inBuildings) loads.toggleAppliance(b, 'machinery', false);
        }
      }
    });

    this.reset();
  }

  public step(context: TickContext): void {
    // 1. Weather update
    const weatherState = this.weather.advance(context);

    // 2. Load model updates (target demands)
    const topology = this.topologyService.get();
    void this.loads.demand(topology, weatherState);
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
      // The power-flow module publishes its own narrower event map.
      events: this.context.events as unknown as TypedEventBus<PowerFlowEventMap>,
    });

    // 5. Protection evaluation — bridge opened lines onto the domain bus as
    // LineTripped so cascade detection and UI projections observe them.
    const protectionResult = this.protection.evaluate({
      graph: this.graph,
      flows: pfResult.flows,
      tick: context.tick,
      timestepS: context.timestep,
    });
    const domainEvents = this.domainEvents();
    for (const openedLine of protectionResult.opened) {
      const relay = this.protection.relayFor(openedLine);
      domainEvents.emit(GRID_EVENT.LineTripped, {
        line: openedLine,
        cause:
          relay?.lastTripTick !== undefined && relay.lastTripTick !== null
            ? LineTripCause.Overload
            : LineTripCause.Operator,
      });
    }

    const lineFlows: LineFlow[] = pfResult.flows.map((f) => {
      const lineId = f.line;
      const b = this.protection.breakerFor(lineId);
      const loading = f.loading;

      let state: LineState = LineState.Nominal;
      if (b) {
        if (b.phase === 'Opening') state = LineState.Tripping;
        else if (b.phase === 'Open') state = LineState.Tripped;
        else if (b.phase === 'Closing') state = LineState.Cooling;
        else if (loading >= OVERLOAD_THRESHOLD_PU) state = LineState.Overloaded;
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

      let zoneState: ZoneState = ZoneState.Powered;
      if (poweredNodes.length === 0) {
        zoneState = ZoneState.Blackout;
      } else if (poweredNodes.length < zoneNodes.length) {
        zoneState = ZoneState.Degraded;
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

      if (zoneState === ZoneState.Blackout && unserved > 0) {
        domainEvents.emit(GRID_EVENT.ZoneBlackout, {
          zone: zone.id,
          unservedLoad: asMegaWatts(unserved),
        });
      } else if (zoneState === ZoneState.Powered) {
        domainEvents.emit(GRID_EVENT.ZonePowered, {
          zone: zone.id,
        });
      }
    }

    // 8. Per-generator status + renewable share (Solar/Wind/Storage output)
    const RENEWABLE_KINDS = new Set(['Solar', 'Wind', 'Storage']);
    let renewableMw = 0;
    const generatorStatuses: GeneratorStatus[] = topology.generators.map((gen) => {
      const output = this.generation.getGeneratorOutput(gen.id);
      if (RENEWABLE_KINDS.has(gen.kind)) renewableMw += output as number;
      return {
        id: gen.id,
        outputMw: output,
        capacityMw: gen.capacity,
        tripped: this.generation.isTripped(gen.id),
      };
    });

    // 9. Frequency dynamics.
    //
    // Frequency is the INTEGRAL of imbalance, not a function of it. The old
    // `60 + 0.005 * (gen - load)` was memoryless: a deficit parked frequency
    // at a value and nothing further happened. Real frequency falls
    // continuously at a rate set by how much rotating mass is online, which
    // is why losing a synchronous machine is qualitatively worse than losing
    // the same MW of solar.
    const machines: readonly FrequencyMachine[] = topology.generators.map((gen) => ({
      id: gen.id,
      kind: gen.kind,
      ratedMw: gen.capacity,
      outputMw: this.generation.getGeneratorOutput(gen.id),
      online: !this.generation.isTripped(gen.id),
    }));

    const freq = this.frequencyModel.step({
      machines,
      generationMw: totalGen,
      demandMw: totalDemand,
      timestepS: context.timestep,
    });

    this.state = {
      frequency: asHertz(freq.frequencyHz),
      rocof: freq.rocofHzPerS,
      inertiaMwS: freq.inertiaMwS,
      uflsStage: freq.uflsStage,
      uflsShedFraction: freq.uflsShedFraction,
      security: freq.security,
      reserveMw: asMegaWatts(freq.reserveMw),
      largestInfeedMw: asMegaWatts(freq.largestInfeedMw),
      lines: lineFlows,
      zones: zoneStatuses,
      totalGeneration: totalGen,
      totalLoad: totalDemand,
      renewableGeneration: asMegaWatts(renewableMw),
      generators: generatorStatuses,
    };

    this.restoration.plan(this.state);

    // 9. Tension pacing / Director
    this.director.pace(context, this.state);

    // NOTE: the kernel emits the single authoritative SimulationTick after all
    // systems have stepped — the engine must not emit its own duplicate.
  }

  public reset(): void {
    (this.weather as IWeatherModel & OptionalLifecycle).reset?.();
    this.generation.reset();
    this.loads.reset();
    this.cascade.reset();
    this.restoration.reset();
    (this.director as IDirector & OptionalLifecycle).reset?.();
    this.frequencyModel.reset();
    this._initializeState();
  }

  public dispose(): void {
    (this.weather as IWeatherModel & OptionalLifecycle).dispose?.();
    this.generation.dispose();
    this.loads.dispose();
    this.cascade.dispose();
    this.restoration.dispose();
  }

  /** The kernel bus, narrowed to the domain event map this engine publishes. */
  private domainEvents(): TypedEventBus<GridEventMap> {
    return this.context.events as unknown as TypedEventBus<GridEventMap>;
  }

  public getState(): GridState {
    return this.state;
  }

  public captureState(): unknown {
    return {
      weather: isSnapshotable(this.weather as unknown as SimulationSystem)
        ? (this.weather as unknown as SnapshotableSystem).captureState()
        : null,
      generation: isSnapshotable(this.generation) ? this.generation.captureState() : null,
      loads: isSnapshotable(this.loads) ? this.loads.captureState() : null,
      cascade: isSnapshotable(this.cascade) ? this.cascade.captureState() : null,
      restoration: isSnapshotable(this.restoration) ? this.restoration.captureState() : null,
      frequency: this.frequencyModel.captureState(),
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
      frequency: unknown;
      state: GridState;
    };
    if (isSnapshotable(this.weather as unknown as SimulationSystem)) {
      (this.weather as unknown as SnapshotableSystem).restoreState(s.weather);
    }
    if (isSnapshotable(this.generation)) this.generation.restoreState(s.generation);
    if (isSnapshotable(this.loads)) this.loads.restoreState(s.loads);
    if (isSnapshotable(this.cascade)) this.cascade.restoreState(s.cascade);
    if (isSnapshotable(this.restoration)) this.restoration.restoreState(s.restoration);
    this.frequencyModel.restoreState(s.frequency);
    this.state = s.state;
  }

  private _initializeState(): void {
    this.state = {
      frequency: asHertz(60),
      rocof: 0,
      inertiaMwS: 0,
      uflsStage: 0,
      uflsShedFraction: 0,
      security: 'Secure',
      reserveMw: asMegaWatts(0),
      largestInfeedMw: asMegaWatts(0),
      lines: [],
      zones: [],
      totalGeneration: asMegaWatts(0),
      totalLoad: asMegaWatts(0),
      renewableGeneration: asMegaWatts(0),
      generators: [],
    };
  }
}
