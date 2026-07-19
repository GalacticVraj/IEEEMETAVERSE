import { asDecisionId, asSystemId } from '@app-types';
import type { DecisionId, Severity, SystemId } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createToken } from '@core';
import type { SimulationSystem, SnapshotableSystem, SystemContext, Token } from '@core';

import type { GridState } from '../model/grid';

export interface DirectorDirective {
  readonly severity: Severity;
  /** Short operator-facing framing for the current beat. */
  readonly message: string;
}

/**
 * The Director paces the experience — the "game feel" brain of the SIMULATION.
 */
export interface IDirector extends SimulationSystem {
  pace(context: any, state: GridState): DirectorDirective;
}

export const DIRECTOR: Token<IDirector> = createToken('Director');

/**
 * Real GridDirector implementation with tension pacing, hysteresis, and decision triggers.
 */
export class GridDirector implements IDirector, SnapshotableSystem {
  public readonly id: SystemId = asSystemId('director');
  private context!: SystemContext;

  private requestedOverload = false;
  private requestedCascade = false;
  private requestedBlackout = false;

  private severityHistory: Severity[] = [];

  public init(context: SystemContext): void {
    this.context = context;
    this.reset();
  }

  public step(): void {
    // Handled in pace()
  }

  public reset(): void {
    this.requestedOverload = false;
    this.requestedCascade = false;
    this.requestedBlackout = false;
    this.severityHistory = [];
  }

  public dispose(): void {
    this.reset();
  }

  public captureState(): unknown {
    return {
      requestedOverload: this.requestedOverload,
      requestedCascade: this.requestedCascade,
      requestedBlackout: this.requestedBlackout,
      severityHistory: [...this.severityHistory],
    };
  }

  public restoreState(state: unknown): void {
    const s = state as {
      requestedOverload: boolean;
      requestedCascade: boolean;
      requestedBlackout: boolean;
      severityHistory: Severity[];
    };
    this.requestedOverload = s.requestedOverload;
    this.requestedCascade = s.requestedCascade;
    this.requestedBlackout = s.requestedBlackout;
    this.severityHistory = [...s.severityHistory];
  }

  public pace(context: any, state: GridState): DirectorDirective {
    const tick = context.tick;

    // 1. Calculate raw severity from grid stress
    let rawSeverity: Severity = 'Info';
    let message = 'Grid operating within nominal parameters.';

    const maxLoading = state.lines.reduce((max, l) => Math.max(max, l.loading), 0);
    const hasCascade = state.lines.some((l) => l.state === 'Tripping' || l.state === 'Tripped');
    const blackedOutZones = state.zones.filter((z) => z.state === 'Blackout');

    if (maxLoading >= 1.1 || hasCascade || blackedOutZones.length > 0) {
      rawSeverity = 'Critical';
      message = 'CRITICAL: Severe overload or blackout detected!';
    } else if (maxLoading >= 0.9) {
      rawSeverity = 'Warning';
      message = 'WARNING: System load approaching transmission limits.';
    } else if (maxLoading >= 0.7) {
      rawSeverity = 'Caution';
      message = 'CAUTION: Line loading elevated.';
    }

    // 2. Hysteresis: smooth out severity drops over a 3-tick window
    this.severityHistory.push(rawSeverity);
    if (this.severityHistory.length > 3) {
      this.severityHistory.shift();
    }

    const severityOrder: Severity[] = ['Info', 'Caution', 'Warning', 'Critical'];
    const activeSeverity = this.severityHistory.reduce((max, s) => {
      const idx = severityOrder.indexOf(s);
      const maxIdx = severityOrder.indexOf(max);
      return idx > maxIdx ? s : max;
    }, 'Info' as Severity);

    // 3. Scripted decision request triggers
    if (maxLoading >= 1.0 && !this.requestedOverload) {
      this.requestedOverload = true;
      this.context.events.emit(GRID_EVENT.DecisionRequested, {
        decisionId: asDecisionId(`dec-overload-${tick}`),
        prompt: 'High line loading detected. Power flows are approaching limits. Choose emergency action:',
        options: [
          'Shed AC in Residential North',
          'Delay EV Charging in Downtown',
          'Shed all Commercial Lighting',
          'Do nothing (rely on automatic relay protection)',
        ],
      });
    }

    if (hasCascade && !this.requestedCascade) {
      this.requestedCascade = true;
      this.context.events.emit(GRID_EVENT.DecisionRequested, {
        decisionId: asDecisionId(`dec-cascade-${tick}`),
        prompt: 'Cascading failure sequence detected! Network stability is compromised. Select emergency intervention:',
        options: [
          'Shed Water Heaters in Residential South',
          'Shed Heavy Machinery in Industrial',
          'Request emergency imports (+100 MW)',
          'Hold current topology and monitor',
        ],
      });
    }

    if (blackedOutZones.length > 0 && !this.requestedBlackout) {
      this.requestedBlackout = true;
      this.context.events.emit(GRID_EVENT.DecisionRequested, {
        decisionId: asDecisionId(`dec-blackout-${tick}`),
        prompt: 'Blackout detected in demand zones! Critical services are running on backup. Select restoration plan:',
        options: [
          'Initiate black-start recovery sequence',
          'Perform sectionalized line reclosing',
          'Shed all commercial load to stabilize remaining grid',
        ],
      });
    }

    return { severity: activeSeverity, message };
  }
}

