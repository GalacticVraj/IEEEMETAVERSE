import type { GeneratorId, LineId, SystemId } from '@app-types';
import { asGeneratorId, asSystemId } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createToken } from '@core';
import type { SimulationSystem, SnapshotableSystem, SystemContext, Token } from '@core';

import type { IGenerationModel } from '../generation/generation';
import type { ElectricalGraph } from '../graph';
import type { GridState } from '../model/grid';
import type { ProtectionEngine } from '../protection/protection-engine';
import type { ITopologyService } from '../topology/topology';

/** Plans re-energization of tripped lines and blacked-out zones. */
export interface IRestorationController extends SimulationSystem {
  plan(state: GridState): void;
}

export const RESTORATION_CONTROLLER: Token<IRestorationController> =
  createToken('RestorationController');

/**
 * Concrete restoration controller managing reclosing and black-starts.
 */
export class DeterministicRestorationController implements IRestorationController, SnapshotableSystem {
  public readonly id: SystemId = asSystemId('restoration-controller');
  private context!: SystemContext;

  public constructor(
    private readonly topologyService: ITopologyService,
    private readonly graph: ElectricalGraph,
    private readonly protectionEngine: ProtectionEngine,
    private readonly generationModel: IGenerationModel,
  ) {}

  public init(context: SystemContext): void {
    this.context = context;
  }

  public step(): void {
    // Handled in plan()
  }

  public reset(): void {
    // Stateless beyond underlying engines
  }

  public dispose(): void {
    // No-op
  }

  public captureState(): unknown {
    return {};
  }

  public restoreState(): void {
    // No-op
  }

  public plan(state: GridState): void {
    const tick = this.context.clock.tick;
    const topology = this.topologyService.get();

    // 1. Process cooled lines for reclosing
    for (const line of topology.lines) {
      const isTripped = this.graph.getLine(line.id) === undefined;
      if (!isTripped) continue;

      const breaker = this.protectionEngine.breakerFor(line.id);
      if (breaker === undefined || breaker.phase !== 'Open') continue;

      const thermal = this.protectionEngine.thermalFor(line.id);
      if (thermal === undefined) continue;

      // Check if temperature has cooled down below warning temperature (warningC)
      const warningC = thermal.config.warningC;
      if (thermal.temperatureC < warningC) {
        // Reset relay lockout/state
        this.protectionEngine.resetRelay(line.id);
        // Command breaker close (will automatically re-add line to graph on completion)
        this.protectionEngine.commandClose(line.id, tick);

        this.context.events.emit(GRID_EVENT.LineRecovered, {
          line: line.id,
        });

        this.context.logger.info('Line cool, initiated reclose sequence', {
          line: line.id,
          temp: thermal.temperatureC,
        });
      }
    }

    // 2. Black-start capability
    // If any zone is in blackout or total load served is 0, make sure black-start generator is available
    const hasBlackout = state.zones.some((z) => z.state === 'Blackout') || state.totalGeneration === 0;
    if (hasBlackout) {
      const blackStartGenId = asGeneratorId('G-GAS-HB');
      if (this.generationModel.isTripped(blackStartGenId)) {
        this.generationModel.untripGenerator(blackStartGenId);
        this.context.logger.info('Blackout detected, initiated black-start on G-GAS-HB');
      }
    }
  }
}
