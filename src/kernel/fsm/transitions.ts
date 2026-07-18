import { SimulationState } from '@app-types';

/**
 * The legal transition graph for the simulation lifecycle. Any transition not
 * listed here is rejected by the state machine.
 *
 * Boot → Loading → Calibration → Idle → Pre-Crisis → Crisis → Cascade →
 * Recovery → After-Action → Replay → Reset → (Boot)
 *
 * Extra edges express real control flow:
 *  - Idle → Reset          abort before a crisis begins
 *  - Pre-Crisis → Idle     a crisis that never materialized
 *  - Crisis → Recovery     contained without a cascade
 *  - Recovery → Crisis     re-escalation during recovery
 *  - Replay → After-Action return to the report after a replay
 */
export const SIMULATION_TRANSITIONS: Readonly<Record<SimulationState, readonly SimulationState[]>> =
  {
    [SimulationState.Boot]: [SimulationState.Loading],
    [SimulationState.Loading]: [SimulationState.Calibration],
    [SimulationState.Calibration]: [SimulationState.Idle],
    [SimulationState.Idle]: [SimulationState.PreCrisis, SimulationState.Reset],
    [SimulationState.PreCrisis]: [SimulationState.Crisis, SimulationState.Idle],
    [SimulationState.Crisis]: [SimulationState.Cascade, SimulationState.Recovery],
    [SimulationState.Cascade]: [SimulationState.Recovery],
    [SimulationState.Recovery]: [SimulationState.AfterAction, SimulationState.Crisis],
    [SimulationState.AfterAction]: [SimulationState.Replay, SimulationState.Reset],
    [SimulationState.Replay]: [SimulationState.AfterAction, SimulationState.Reset],
    [SimulationState.Reset]: [SimulationState.Boot],
  };
