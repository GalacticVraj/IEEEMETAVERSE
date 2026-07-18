import { KernelState } from '@app-types';

/**
 * The legal transition graph for the kernel runtime lifecycle. Any transition
 * not listed here is rejected with a descriptive error. There are no hidden or
 * implicit transitions.
 *
 * Boot → Loading → Configuration → RegisterSystems → Calibration → Idle,
 * then Idle ⇄ Running ⇄ Paused, with Replay reachable from Idle/Paused, and
 * Shutdown → Disposed (terminal).
 */
export const KERNEL_TRANSITIONS: Readonly<Record<KernelState, readonly KernelState[]>> = {
  [KernelState.Boot]: [KernelState.Loading],
  [KernelState.Loading]: [KernelState.Configuration],
  [KernelState.Configuration]: [KernelState.RegisterSystems],
  [KernelState.RegisterSystems]: [KernelState.Calibration],
  [KernelState.Calibration]: [KernelState.Idle],
  [KernelState.Idle]: [KernelState.Running, KernelState.Replay, KernelState.Shutdown],
  [KernelState.Running]: [KernelState.Paused, KernelState.Idle, KernelState.Shutdown],
  [KernelState.Paused]: [
    KernelState.Running,
    KernelState.Idle,
    KernelState.Replay,
    KernelState.Shutdown,
  ],
  [KernelState.Replay]: [KernelState.Idle, KernelState.Shutdown],
  [KernelState.Shutdown]: [KernelState.Disposed],
  [KernelState.Disposed]: [],
};
