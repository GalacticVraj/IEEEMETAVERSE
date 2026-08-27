import { Severity, asGeneratorId, asLineId, asScenarioId } from '@app-types';
import type { TickContext } from '@core';
import { CLEAR_ARC } from '@engine';

import type {
  ICrisisScenario,
  ScenarioContext,
  ScenarioFaultApi,
  ScenarioMetadata,
} from '../crisis-scenario';
import { at } from '../shift-clock';
import { setTelemetryTrust } from '../telemetry-trust';

/**
 * **Coordinated Cyber Attack** — a SCADA intrusion, seen from the control room.
 *
 * NOTE: this models cyber-physical CONSEQUENCES, not network exploitation. The
 * intrusion is narrative; mechanically it injects real faults through the same
 * fault API every other scenario uses, and the grid responds with the same
 * physics.
 *
 * Re-choreographed onto the 1,800-tick shift — the previous timeline ran ticks
 * 40–85, so the whole attack was over 8.5 seconds into a three-minute run.
 *
 * - T+0:00 · Telemetry integrity is already compromised. Corridor readings are
 *   marked UNVERIFIED: the operator can see the numbers, but not trust them.
 * - T+0:30 · The attacker opens GS1-DT1 remotely — the main downtown infeed.
 * - T+1:00 · A second coordinated open on DT1-IN1. This is the signature of an
 *   attack rather than a fault: two breakers, no protection reason, minutes apart.
 * - T+1:30 · Telemetry integrity is restored as engineers isolate the
 *   compromised RTUs. The numbers can be trusted again — and they are bad.
 * - T+2:00 · The import interconnect is tripped through a compromised relay.
 *   400 MW of in-feed gone at the point of least reserve.
 *
 * The distinctive mechanic is the UNVERIFIED window: for the first ninety
 * seconds the console shows measured values it explicitly refuses to vouch
 * for. That is the real lesson of grid cyber-security — losing trust in your
 * instruments is a different, harder problem than losing a line.
 */
export class CyberAttackScenario implements ICrisisScenario {
  public readonly metadata: ScenarioMetadata = {
    id: asScenarioId('cyber-attack'),
    name: 'Coordinated Cyber Attack',
    summary:
      'A coordinated SCADA intrusion corrupts corridor telemetry, then opens critical ' +
      'breakers in sequence and kills the import interconnect while the operator is flying blind.',
    difficulty: Severity.Critical,
  };

  private faults!: ScenarioFaultApi;
  private breach1 = false;
  private breach2 = false;
  private importKilled = false;
  private trustRestored = false;

  public setup(context: ScenarioContext): void {
    this.faults = context.faults;
    // A clear evening: nothing about this crisis is environmental, and that is
    // the point — every anomaly the operator sees is somebody's decision.
    context.weather.setArc(CLEAR_ARC);
    this.breach1 = false;
    this.breach2 = false;
    this.importKilled = false;
    this.trustRestored = false;
    // Compromised from the first tick. The console reads this flag and marks
    // affected instruments UNVERIFIED; it does not alter a single number.
    setTelemetryTrust({
      compromised: true,
      reason: 'SCADA integrity alarm — corridor telemetry is unauthenticated.',
    });
  }

  public onTick(context: TickContext): void {
    const { tick } = context;

    // T+0:30 — remote breaker open on the main downtown infeed.
    if (tick === at(0, 30) && !this.breach1) {
      this.faults.commandOpenLine(asLineId('GS1-DT1'));
      this.breach1 = true;
    }

    // T+1:00 — the second open. Two breakers with no protection reason is what
    // separates an attack from a fault.
    if (tick === at(1, 0) && !this.breach2) {
      this.faults.commandOpenLine(asLineId('DT1-IN1'));
      this.breach2 = true;
    }

    // T+1:30 — compromised RTUs isolated; the instruments can be believed again.
    if (tick === at(1, 30) && !this.trustRestored) {
      setTelemetryTrust({ compromised: false, reason: null });
      this.trustRestored = true;
    }

    // T+2:00 — the import tie is dropped through a compromised relay, at the
    // point in the shift where there is least reserve to cover it.
    if (tick === at(2, 0) && !this.importKilled) {
      this.faults.tripGenerator(asGeneratorId('G-IMPORT'));
      this.importKilled = true;
    }
  }

  public teardown(): void {
    if (this.importKilled) {
      this.faults.untripGenerator(asGeneratorId('G-IMPORT'));
    }
    this.faults.resetShedding();
    // Never leave the console distrusting its own instruments after the run.
    setTelemetryTrust({ compromised: false, reason: null });
  }
}
