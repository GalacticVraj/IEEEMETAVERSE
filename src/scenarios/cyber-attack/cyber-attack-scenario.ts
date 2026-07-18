import { Severity, asGeneratorId, asLineId, asLoadId, asScenarioId } from '@app-types';
import type { TickContext } from '@core';

import type { ICrisisScenario, ScenarioContext, ScenarioFaultApi, ScenarioMetadata } from '../crisis-scenario';

/**
 * **Cyber Attack** — coordinated SCADA intrusion targeting control systems.
 *
 * NOTE: This scenario models cyber-physical consequences only (fault injection),
 * not actual network exploitation. The "cyber" framing is narrative; mechanically
 * it injects targeted faults at specific ticks to simulate what a real intrusion
 * would accomplish against the physical grid.
 *
 * Timeline:
 * - Ticks 0–39:   Attacker probes SCADA systems. Grid nominal.
 * - Tick 40:      Attacker opens GS1-DT1 breaker remotely (main infeed cut).
 * - Ticks 41–54:  DT zone now fed only from GN1-DT1; overloaded.
 * - Tick 55:      Attacker opens DT1-IN1 (second breaker) — coordinated attack.
 * - Ticks 56–69:  Industrial zone degraded; downtown highly stressed.
 * - Tick 70:      Attacker trips import interconnect G-IMPORT — 200 MW lost.
 * - Ticks 70–99:  Frequency deviation; generator protection may auto-trip.
 * - Tick 85:      Automated load shedding (UFLS simulation) sheds 30% residential.
 */
export class CyberAttackScenario implements ICrisisScenario {
  public readonly metadata: ScenarioMetadata = {
    id: asScenarioId('cyber-attack'),
    name: 'Coordinated Cyber Attack',
    summary:
      'A coordinated SCADA intrusion opens critical breakers in sequence, '
      + 'then kills the import interconnect, driving frequency collapse.',
    difficulty: Severity.Critical,
  };

  private faults!: ScenarioFaultApi;
  private attack1 = false;
  private attack2 = false;
  private attack3 = false;
  private ufls = false;

  public setup(context: ScenarioContext): void {
    this.faults = context.faults;
    this.attack1 = false;
    this.attack2 = false;
    this.attack3 = false;
    this.ufls = false;
  }

  public onTick(context: TickContext): void {
    const { tick } = context;

    // Tick 40: Remote breaker open — main infeed GS1-DT1
    if (tick === 40 && !this.attack1) {
      this.faults.commandOpenLine(asLineId('GS1-DT1'));
      this.attack1 = true;
    }

    // Tick 55: Second coordinated open — DT1-IN1
    if (tick === 55 && !this.attack2) {
      this.faults.commandOpenLine(asLineId('DT1-IN1'));
      this.attack2 = true;
    }

    // Tick 70: Import interconnect tripped via compromised relay
    if (tick === 70 && !this.attack3) {
      this.faults.tripGenerator(asGeneratorId('G-IMPORT'));
      this.attack3 = true;
    }

    // Tick 85: UFLS — Under-Frequency Load Shedding (automatic protection response)
    if (tick === 85 && !this.ufls) {
      this.faults.shedLoad(asLoadId('LD-RN-A'), 0.30);
      this.faults.shedLoad(asLoadId('LD-RN-B'), 0.30);
      this.faults.shedLoad(asLoadId('LD-RS-A'), 0.30);
      this.faults.shedLoad(asLoadId('LD-RS-B'), 0.30);
      this.ufls = true;
    }
  }

  public teardown(): void {
    if (this.attack3) {
      this.faults.untripGenerator(asGeneratorId('G-IMPORT'));
    }
    if (this.ufls) {
      this.faults.resetShedding();
    }
  }
}
