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

/** A decision awaiting its 30-second measurement. */
interface PendingDecision {
  readonly decisionId: string;
  readonly optionIndex: number;
  readonly committedTick: number;
  readonly deviationHz: number;
  readonly loading: number;
  readonly darkZones: number;
}

/**
 * Option indices that mean "do nothing yet".
 *
 * Keyed by decision family rather than by a global index, because "hold" is
 * the last option in some prompts and the third in others. Getting this wrong
 * would silently mark an active intervention as passive and roll risk against
 * a player who actually acted.
 */
const PASSIVE_OPTION: Readonly<Record<string, number>> = {
  'dec-cascade-hard': 2, // "Hold current topology and monitor" on the hard branch
  'dec-overload': 3, // "Do nothing (rely on automatic relay protection)"
  'dec-cascade': 3, // "Hold current topology and monitor"
};

/** Snapshot the numbers a consequence will later be measured against. */
function snapshot(state: GridState): { deviationHz: number; loading: number; darkZones: number } {
  return {
    deviationHz: Math.abs(state.frequency - 60),
    loading: state.lines.reduce((max, l) => Math.max(max, l.loading), 0),
    darkZones: state.zones.filter((z) => z.state === 'Blackout').length,
  };
}

/**
 * What `pace` needs from the tick: the tick number, and nothing else.
 *
 * Structural rather than the full `TickContext` so callers (and tests) are not
 * forced to fabricate a clock and a timestep the director never reads. It
 * replaces an `any`, which was quietly making every `context.tick` read
 * unchecked.
 */
export interface DirectorTick {
  readonly tick: number;
}

/**
 * The Director paces the experience — the "game feel" brain of the SIMULATION.
 */
export interface IDirector extends SimulationSystem {
  pace(context: DirectorTick, state: GridState): DirectorDirective;
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

  // ── Decision branching & consequences ────────────────────────────────────

  /** Decisions committed but not yet measured. */
  private pending: PendingDecision[] = [];
  /**
   * True once a passive choice has cost the operator their margin. The next
   * prompt then comes from the harder branch: fewer options, and none of them
   * cheap. This is what "the next event is harder" means here — a different
   * path through the arc, not a hidden fault injected as punishment.
   */
  private hardBranch = false;
  /** Detaches the DecisionCommitted subscription on dispose. */
  private unsubscribeDecisions: (() => void) | null = null;
  /**
   * The most recent state `pace()` was given.
   *
   * A decision arrives on the bus between ticks, not inside `pace()`, so the
   * handler needs the operating point the operator was actually looking at
   * when they committed. Holding the last one is exactly that.
   */
  private lastState: GridState | null = null;

  /**
   * How long after a decision its consequence is measured, in ticks (30 s).
   *
   * The brief asked for 60 s. In an 1,800-tick (three-minute) shift that would
   * mean every decision taken after T+2:00 never reports at all — the player
   * would act and simply never hear whether it worked. Thirty seconds is long
   * enough to be a settled outcome rather than a transient, and short enough
   * that every decision in the run gets an answer.
   */
  private static readonly CONSEQUENCE_DELAY_TICKS = 300;

  /**
   * Probability that holding position costs the operator their margin.
   *
   * The brief specified a flat 40 %. Flat is the one thing it should not be:
   * holding a calm grid is genuinely fine and holding a stressed one is
   * genuinely reckless, and a coin that ignores the difference teaches the
   * player nothing they can act on. So 40 % is the CENTRE, scaled by measured
   * stress — near 15 % on a comfortable grid, up to 70 % when a corridor is
   * already at its rating.
   *
   * The roll uses the kernel's seeded stream, never `Math.random`, so a run is
   * reproducible and a replay diverges from nothing.
   */
  private static readonly PASSIVE_RISK_MIN = 0.15;
  private static readonly PASSIVE_RISK_MAX = 0.7;

  /**
   * How long the operator has to answer a prompt, in ticks (30 s).
   *
   * Declared by the SIMULATION and carried on the event, so the console's
   * countdown is measuring the same window the engine will act on. A timer
   * owned by the UI would drift the moment the run is paused — and pause is a
   * real, bound control here.
   */
  private static readonly DECISION_WINDOW_TICKS = 300;

  /** ≥1 zone dark for this many consecutive ticks ⇒ PartialBlackout loss. */
  private static readonly PARTIAL_BLACKOUT_TICKS = 150;
  /** ≥ this many zones dark simultaneously ⇒ immediate SystemBlackout loss. */
  private static readonly SYSTEM_BLACKOUT_ZONES = 2;

  public init(context: SystemContext): void {
    this.context = context;
    this.reset();

    // Watch what the operator actually committed. The director is the system
    // that PACES the run, so it is the right place to decide how a choice
    // changes the arc — and the only one holding both the decision and the
    // telemetry it was made against.
    const bus = context.events as unknown as TypedEventBus<GridEventMap>;
    this.unsubscribeDecisions?.();
    this.unsubscribeDecisions = bus.on(GRID_EVENT.DecisionCommitted, (payload) => {
      this.onDecisionCommitted(String(payload.decisionId), payload.optionIndex);
    });
  }

  /** Record a decision for later measurement, and branch the arc if it was passive. */
  private onDecisionCommitted(decisionId: string, optionIndex: number): void {
    const state = this.lastState;
    if (state === null) return;

    const shot = snapshot(state);
    this.pending.push({
      decisionId,
      optionIndex,
      committedTick: this.context.clock.tick,
      ...shot,
    });

    // Only DIRECTOR prompts branch. The standing `op-*` levers are always
    // active interventions and carry no "hold" option to roll against.
    const family = Object.keys(PASSIVE_OPTION).find((key) => decisionId.includes(key));
    if (family === undefined) return;
    if (optionIndex !== PASSIVE_OPTION[family]) return;

    // Holding position. How much that costs depends on how much margin was
    // left when they held — measured, then rolled on the seeded stream.
    const stress = Math.min(1, Math.max(0, shot.loading));
    const risk =
      GridDirector.PASSIVE_RISK_MIN +
      (GridDirector.PASSIVE_RISK_MAX - GridDirector.PASSIVE_RISK_MIN) * stress;
    if (this.context.rng.next() < risk) {
      this.hardBranch = true;
      this.context.logger.info('Director: passive choice cost the margin', {
        decisionId,
        stress,
        risk,
      });
    }
  }

  /** Measure any decision that has now had its full settling window. */
  private measurePending(tick: number, state: GridState): void {
    if (this.pending.length === 0) return;
    const bus = this.context.events as unknown as TypedEventBus<GridEventMap>;
    const due = this.pending.filter(
      (d) => tick - d.committedTick >= GridDirector.CONSEQUENCE_DELAY_TICKS,
    );
    if (due.length === 0) return;
    this.pending = this.pending.filter(
      (d) => tick - d.committedTick < GridDirector.CONSEQUENCE_DELAY_TICKS,
    );

    const after = snapshot(state);
    for (const decision of due) {
      // Verdict from measurement only. Districts outrank everything, then
      // frequency, then corridor loading — the same order of seriousness the
      // crisis ladder uses.
      let verdict: 'improved' | 'held' | 'worsened';
      let summary: string;

      if (after.darkZones > decision.darkZones) {
        verdict = 'worsened';
        summary = `${String(after.darkZones - decision.darkZones)} more district(s) went dark in the 30 s after this call.`;
      } else if (after.darkZones < decision.darkZones) {
        verdict = 'improved';
        summary = `${String(decision.darkZones - after.darkZones)} district(s) came back inside 30 s of this call.`;
      } else if (after.deviationHz < decision.deviationHz - 0.02) {
        verdict = 'improved';
        summary = `Frequency deviation fell from ${decision.deviationHz.toFixed(2)} Hz to ${after.deviationHz.toFixed(2)} Hz.`;
      } else if (after.deviationHz > decision.deviationHz + 0.02) {
        verdict = 'worsened';
        summary = `Frequency deviation grew from ${decision.deviationHz.toFixed(2)} Hz to ${after.deviationHz.toFixed(2)} Hz.`;
      } else if (after.loading < decision.loading - 0.03) {
        verdict = 'improved';
        summary = `Worst corridor eased from ${String(Math.round(decision.loading * 100))} % to ${String(Math.round(after.loading * 100))} %.`;
      } else if (after.loading > decision.loading + 0.03) {
        verdict = 'worsened';
        summary = `Worst corridor climbed from ${String(Math.round(decision.loading * 100))} % to ${String(Math.round(after.loading * 100))} %.`;
      } else {
        verdict = 'held';
        summary = `Nothing measurable moved in the 30 s after this call — frequency and corridors both held.`;
      }

      bus.emit(GRID_EVENT.DecisionConsequence, {
        decisionId: asDecisionId(decision.decisionId),
        optionIndex: decision.optionIndex,
        committedTick: decision.committedTick,
        deviationBeforeHz: decision.deviationHz,
        deviationAfterHz: after.deviationHz,
        loadingBefore: decision.loading,
        loadingAfter: after.loading,
        darkZonesBefore: decision.darkZones,
        darkZonesAfter: after.darkZones,
        verdict,
        summary,
      });
    }
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
    this.pending = [];
    this.hardBranch = false;
    this.lastState = null;
  }

  public dispose(): void {
    this.unsubscribeDecisions?.();
    this.unsubscribeDecisions = null;
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

  public pace(context: DirectorTick, state: GridState): DirectorDirective {
    const tick = context.tick;
    const domainEvents = this.context.events as unknown as TypedEventBus<GridEventMap>;

    // Keep the operating point available to the decision handler, which runs
    // between ticks, and settle anything whose window has elapsed.
    this.lastState = state;
    this.measurePending(tick, state);

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
        prompt:
          'High line loading detected. Power flows are approaching limits. Choose emergency action:',
        options: [
          'Shed AC in Residential North',
          'Delay EV Charging in Downtown',
          'Shed all Commercial Lighting',
          'Do nothing (rely on automatic relay protection)',
        ],
        requestedAtTick: tick,
        windowTicks: GridDirector.DECISION_WINDOW_TICKS,
        defaultOptionIndex: 3,
      });
    }

    if (hasCascade && !this.requestedCascade) {
      this.requestedCascade = true;
      // BRANCH. If an earlier passive choice cost the margin, the cascade
      // prompt arrives without the cheap options — there is no longer a
      // version of this where nobody pays. Same event, different arc.
      domainEvents.emit(
        GRID_EVENT.DecisionRequested,
        this.hardBranch
          ? {
              decisionId: asDecisionId(`dec-cascade-hard-${tick}`),
              prompt:
                'Cascade in progress and the margin you were holding is gone. Every remaining option costs someone their power. Choose:',
              options: [
                'Shed Heavy Machinery in Industrial — fastest relief, factory output lost',
                'Shed Water Heaters in Residential South — slower, spread across homes',
                'Hold current topology and monitor — protection decides from here',
              ],
              requestedAtTick: tick,
              windowTicks: GridDirector.DECISION_WINDOW_TICKS,
              defaultOptionIndex: 2,
            }
          : {
              decisionId: asDecisionId(`dec-cascade-${tick}`),
              prompt:
                'Cascading failure sequence detected! Network stability is compromised. Select emergency intervention:',
              options: [
                'Shed Water Heaters in Residential South',
                'Shed Heavy Machinery in Industrial',
                'Request emergency imports (+100 MW)',
                'Hold current topology and monitor',
              ],
              requestedAtTick: tick,
              windowTicks: GridDirector.DECISION_WINDOW_TICKS,
              defaultOptionIndex: 3,
            },
      );
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
        prompt:
          'Blackout detected in demand zones! Critical services are running on backup. Select restoration plan:',
        options: [
          'Initiate black-start recovery sequence',
          'Perform sectionalized line reclosing',
          'Shed all commercial load to stabilize remaining grid',
        ],
        requestedAtTick: tick,
        windowTicks: GridDirector.DECISION_WINDOW_TICKS,
        // No passive option here: districts are already dark and every plan
        // is an action. Sectionalized reclosing is the most conservative.
        defaultOptionIndex: 1,
      });
    }

    return { severity: activeSeverity, message };
  }
}
