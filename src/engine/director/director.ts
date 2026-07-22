import { GameOutcome, asDecisionId, asSystemId } from '@app-types';
import type { Severity, SystemId } from '@app-types';
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

  /** Consecutive ticks with ≥1 zone in blackout (partial-blackout countdown). */
  private blackoutTicks = 0;
  /** Single-fire guard for the terminal GameEnded emit. */
  private gameEndedFired = false;

  /** ≥1 zone dark for this many consecutive ticks ⇒ PartialBlackout loss. */
  private static readonly PARTIAL_BLACKOUT_TICKS = 150;
  /** ≥ this many zones dark simultaneously ⇒ immediate SystemBlackout loss. */
  private static readonly SYSTEM_BLACKOUT_ZONES = 2;

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
    this.blackoutTicks = 0;
    this.gameEndedFired = false;
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
      blackoutTicks: this.blackoutTicks,
      gameEndedFired: this.gameEndedFired,
    };
  }

  public restoreState(state: unknown): void {
    const s = state as {
      requestedOverload: boolean;
      requestedCascade: boolean;
      requestedBlackout: boolean;
      severityHistory: Severity[];
      blackoutTicks?: number;
      gameEndedFired?: boolean;
    };
    this.requestedOverload = s.requestedOverload;
    this.requestedCascade = s.requestedCascade;
    this.requestedBlackout = s.requestedBlackout;
    this.severityHistory = [...s.severityHistory];
    this.blackoutTicks = s.blackoutTicks ?? 0;
    this.gameEndedFired = s.gameEndedFired ?? false;
  }

  public pace(context: any, state: GridState): DirectorDirective {
    const tick = context.tick;
    const domainEvents = this.context.events as unknown as TypedEventBus<GridEventMap>;

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
      domainEvents.emit(GRID_EVENT.DecisionRequested, {
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
      domainEvents.emit(GRID_EVENT.DecisionRequested, {
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

    // 4. Terminal loss conditions — the director owns win/lose semantics.
    if (!this.gameEndedFired) {
      if (blackedOutZones.length >= GridDirector.SYSTEM_BLACKOUT_ZONES) {
        this.gameEndedFired = true;
        domainEvents.emit(GRID_EVENT.GameEnded, {
          outcome: GameOutcome.SystemBlackout,
          score: 0,
        });
      } else if (blackedOutZones.length >= 1) {
        this.blackoutTicks += 1;
        if (this.blackoutTicks >= GridDirector.PARTIAL_BLACKOUT_TICKS) {
          this.gameEndedFired = true;
          domainEvents.emit(GRID_EVENT.GameEnded, {
            outcome: GameOutcome.PartialBlackout,
            score: 40,
          });
        }
      } else {
        this.blackoutTicks = 0;
      }
    }

    if (blackedOutZones.length > 0 && !this.requestedBlackout) {
      this.requestedBlackout = true;
      domainEvents.emit(GRID_EVENT.DecisionRequested, {
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

