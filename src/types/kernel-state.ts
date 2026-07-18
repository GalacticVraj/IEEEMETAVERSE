/**
 * Names of the SIMULATION KERNEL runtime lifecycle — the domain-agnostic
 * operating states of the runtime itself. These describe how the runtime is
 * executing (booting, running, paused, replaying, disposed), NOT anything about
 * gameplay, electrical grids, or a crisis arc. The kernel must never know about
 * those; a domain state machine (crisis calm→cascade→recovery) is a separate,
 * later concern owned by the engine/director.
 *
 * Flow: Boot → Loading → Configuration → RegisterSystems → Calibration → Idle →
 * Running ⇄ Paused → Replay → Shutdown → Disposed.
 *
 * The vocabulary lives in this leaf so `@core` event payloads and the `@kernel`
 * FSM can both reference it without forming a dependency cycle. The transition
 * RULES live with the implementation in `@kernel`.
 */
export const KernelState = {
  Boot: 'Boot',
  Loading: 'Loading',
  Configuration: 'Configuration',
  RegisterSystems: 'RegisterSystems',
  Calibration: 'Calibration',
  Idle: 'Idle',
  Running: 'Running',
  Paused: 'Paused',
  Replay: 'Replay',
  Shutdown: 'Shutdown',
  Disposed: 'Disposed',
} as const;

export type KernelState = (typeof KernelState)[keyof typeof KernelState];
