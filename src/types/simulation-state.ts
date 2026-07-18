/**
 * Canonical names of the simulation lifecycle state machine.
 *
 * The state VOCABULARY lives here (a dependency-free leaf) so that both the
 * kernel FSM implementation (`@kernel/fsm`) and the event payloads (`@core`)
 * can reference it without creating a cycle. The transition RULES live with the
 * implementation in `@kernel/fsm`.
 *
 * Flow: Boot → Loading → Calibration → Idle → Pre-Crisis → Crisis → Cascade →
 * Recovery → After-Action → Replay → Reset.
 */
export const SimulationState = {
  Boot: 'Boot',
  Loading: 'Loading',
  Calibration: 'Calibration',
  Idle: 'Idle',
  PreCrisis: 'PreCrisis',
  Crisis: 'Crisis',
  Cascade: 'Cascade',
  Recovery: 'Recovery',
  AfterAction: 'AfterAction',
  Replay: 'Replay',
  Reset: 'Reset',
} as const;

export type SimulationState = (typeof SimulationState)[keyof typeof SimulationState];
