import { asSystemId } from '@app-types';
import type { LineId, LineTripCause, SystemId } from '@app-types';
import { GRID_EVENT } from '@constants';
import { createToken } from '@core';
import type { SimulationSystem, SnapshotableSystem, SystemContext, Token } from '@core';

import type { LineFlow } from '../model/grid';

export interface CascadeState {
  readonly active: boolean;
  readonly step: number;
  readonly trippedLines: readonly LineId[];
}

/** Propagates overload-induced trips into cascading failure sequences. */
export interface ICascadeEngine extends SimulationSystem {
  /** Given post-trip flows, compute the next cascade step (re-distribution). */
  propagate(flows: readonly LineFlow[]): CascadeState;
  isActive(): boolean;
}

export const CASCADE_ENGINE: Token<ICascadeEngine> = createToken('CascadeEngine');

/**
 * Concrete deterministic cascade engine.
 */
export class DeterministicCascadeEngine implements ICascadeEngine, SnapshotableSystem {
  public readonly id: SystemId = asSystemId('cascade-engine');
  private context!: SystemContext;
  private active = false;
  private cascadeId = '';
  private stepCount = 0;
  private trippedAll: LineId[] = [];

  // Temporary buffers for the current tick
  private trippedThisTick: LineId[] = [];
  private trippedCausesThisTick = new Map<LineId, LineTripCause>();

  public init(context: SystemContext): void {
    this.context = context;
    this.reset();

    // Subscribe to LineTripped events to buffer trips as they happen
    this.context.events.on(GRID_EVENT.LineTripped, (payload) => {
      this.trippedThisTick.push(payload.line);
      this.trippedCausesThisTick.set(payload.line, payload.cause);
    });
  }

  public step(): void {
    // Handled in propagate()
  }

  public reset(): void {
    this.active = false;
    this.cascadeId = '';
    this.stepCount = 0;
    this.trippedAll = [];
    this.trippedThisTick = [];
    this.trippedCausesThisTick.clear();
  }

  public dispose(): void {
    this.reset();
  }

  public captureState(): unknown {
    return {
      active: this.active,
      cascadeId: this.cascadeId,
      stepCount: this.stepCount,
      trippedAll: [...this.trippedAll],
      trippedThisTick: [...this.trippedThisTick],
      trippedCausesThisTick: Array.from(this.trippedCausesThisTick.entries()),
    };
  }

  public restoreState(state: unknown): void {
    const s = state as {
      active: boolean;
      cascadeId: string;
      stepCount: number;
      trippedAll: LineId[];
      trippedThisTick: LineId[];
      trippedCausesThisTick: [LineId, LineTripCause][];
    };
    this.active = s.active;
    this.cascadeId = s.cascadeId;
    this.stepCount = s.stepCount;
    this.trippedAll = [...s.trippedAll];
    this.trippedThisTick = [...s.trippedThisTick];
    this.trippedCausesThisTick = new Map(s.trippedCausesThisTick);
  }

  public isActive(): boolean {
    return this.active;
  }

  public propagate(flows: readonly LineFlow[]): CascadeState {
    const tick = this.context.clock.tick;

    // Filter to find overload/cascade trips that occurred this tick
    const overloadTrips = this.trippedThisTick.filter(
      (line) =>
        this.trippedCausesThisTick.get(line) === 'Overload' ||
        this.trippedCausesThisTick.get(line) === 'Cascade',
    );

    if (overloadTrips.length > 0) {
      if (!this.active) {
        // Start a new cascade
        this.active = true;
        this.cascadeId = `cascade-${tick}`;
        this.stepCount = 1;
        this.trippedAll = [...overloadTrips];

        this.context.events.emit(GRID_EVENT.CascadeStarted, {
          cascadeId: this.cascadeId,
          originLine: overloadTrips[0] as LineId,
        });

        // If multiple lines tripped, emit CascadeStep for the others
        for (let i = 1; i < overloadTrips.length; i++) {
          this.context.events.emit(GRID_EVENT.CascadeStep, {
            cascadeId: this.cascadeId,
            step: this.stepCount,
            trippedLine: overloadTrips[i] as LineId,
          });
        }
      } else {
        // Continue active cascade
        this.stepCount += 1;
        this.trippedAll.push(...overloadTrips);

        for (const line of overloadTrips) {
          this.context.events.emit(GRID_EVENT.CascadeStep, {
            cascadeId: this.cascadeId,
            step: this.stepCount,
            trippedLine: line,
          });
        }
      }

      // Check max depth guard (10 steps)
      if (this.stepCount >= 10) {
        this.active = false;
        this.context.events.emit(GRID_EVENT.CascadeEnded, {
          cascadeId: this.cascadeId,
          totalSteps: this.stepCount,
          contained: false,
        });
      }
    } else {
      // No new overload trips this tick
      if (this.active) {
        // Cascade ended (contained)
        this.active = false;
        this.context.events.emit(GRID_EVENT.CascadeEnded, {
          cascadeId: this.cascadeId,
          totalSteps: this.stepCount,
          contained: true,
        });
      }
    }

    // Clear tick buffers
    this.trippedThisTick = [];
    this.trippedCausesThisTick.clear();

    return {
      active: this.active,
      step: this.stepCount,
      trippedLines: [...this.trippedAll],
    };
  }
}

