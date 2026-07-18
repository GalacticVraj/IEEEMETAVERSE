import { BreakerPhase } from './breaker';
import type { BreakerPhase as BreakerPhaseType } from './breaker';
import type { ProtectionEngine } from './protection-engine';
import { RelayPhase } from './relay';
import type { RelayPhase as RelayPhaseType } from './relay';
import type { ThermalLevel } from './thermal';

export interface RelayDiagnostic {
  readonly line: string;
  readonly phase: RelayPhaseType;
  readonly operationCount: number;
  readonly lastTripTick: number | null;
}

export interface BreakerDiagnostic {
  readonly line: string;
  readonly phase: BreakerPhaseType;
  readonly operationCount: number;
}

export interface ThermalDiagnostic {
  readonly line: string;
  readonly temperatureC: number;
  readonly level: ThermalLevel;
}

export interface ProtectionDiagnostics {
  readonly relayCount: number;
  readonly breakerCount: number;
  readonly lockedOutRelays: number;
  readonly openBreakers: number;
  readonly totalOperations: number;
  readonly hottestC: number;
  readonly relays: readonly RelayDiagnostic[];
  readonly breakers: readonly BreakerDiagnostic[];
  readonly thermals: readonly ThermalDiagnostic[];
}

const levelOf = (temperatureC: number, warningC: number, maxSafeC: number): ThermalLevel => {
  if (temperatureC > maxSafeC) return 'critical';
  if (temperatureC > warningC) return 'warning';
  return 'normal';
};

/** Structured protection diagnostics (debug/console only). */
export function protectionDiagnostics(engine: ProtectionEngine): ProtectionDiagnostics {
  const relays = engine.relays();
  const breakers = engine.breakers();
  const thermals = engine.thermals();

  return {
    relayCount: relays.length,
    breakerCount: breakers.length,
    lockedOutRelays: relays.filter((relay) => relay.phase === RelayPhase.LockedOut).length,
    openBreakers: breakers.filter((breaker) => breaker.phase === BreakerPhase.Open).length,
    totalOperations: relays.reduce((sum, relay) => sum + relay.operationCount, 0),
    hottestC: thermals.reduce((max, thermal) => Math.max(max, thermal.temperatureC), 0),
    relays: relays.map((relay) => ({
      line: String(relay.line),
      phase: relay.phase,
      operationCount: relay.operationCount,
      lastTripTick: relay.lastTripTick,
    })),
    breakers: breakers.map((breaker) => ({
      line: String(breaker.line),
      phase: breaker.phase,
      operationCount: breaker.operationCount,
    })),
    thermals: thermals.map((thermal) => ({
      line: String(thermal.line),
      temperatureC: thermal.temperatureC,
      level: levelOf(thermal.temperatureC, thermal.config.warningC, thermal.config.maxSafeC),
    })),
  };
}

/** One-line console summary. */
export function formatProtectionDiagnostics(diagnostics: ProtectionDiagnostics): string {
  return [
    `protection relays=${diagnostics.relayCount} breakers=${diagnostics.breakerCount}`,
    `lockedOut=${diagnostics.lockedOutRelays} open=${diagnostics.openBreakers} ops=${diagnostics.totalOperations}`,
    `hottest=${diagnostics.hottestC.toFixed(1)}°C`,
  ].join(' | ');
}
