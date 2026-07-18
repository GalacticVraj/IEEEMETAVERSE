/**
 * Canonical registry of every simulation event name.
 *
 * RULE: no event is ever emitted or subscribed to by string literal. All code
 * references `GRID_EVENT.X`, and the typed payload for each name lives in
 * `@core/events` (`GridEventMap`). Adding an event means adding it here AND to
 * `GridEventMap` — the compiler enforces the pairing.
 *
 * See docs/architecture/06-event-architecture.md for the full catalogue.
 */
export const GRID_EVENT = {
  /** One fixed-timestep advance of simulation time completed. */
  SimulationTick: 'SimulationTick',
  /** Simulation lifecycle state machine changed state. */
  SimStateChanged: 'SimStateChanged',

  /** Environmental regime changed (temperature, irradiance, wind). */
  WeatherChanged: 'WeatherChanged',
  /** Aggregate or per-zone demand changed. */
  LoadChanged: 'LoadChanged',
  /** Generation dispatch / availability changed. */
  GenerationChanged: 'GenerationChanged',
  /** A power-flow solve completed; line loadings are updated. */
  PowerFlowSolved: 'PowerFlowSolved',

  /** A line exceeded its thermal rating. */
  LineOverloaded: 'LineOverloaded',
  /** Protection has begun a (time-delayed) trip on a line. */
  LineTripStarted: 'LineTripStarted',
  /** A line opened (de-energised). */
  LineTripped: 'LineTripped',
  /** A tripped line is thermally cooling toward re-close eligibility. */
  LineCooling: 'LineCooling',
  /** A line recovered and is back in service. */
  LineRecovered: 'LineRecovered',

  /** A cascading failure sequence began. */
  CascadeStarted: 'CascadeStarted',
  /** One discrete propagation step within an active cascade. */
  CascadeStep: 'CascadeStep',
  /** A cascade sequence terminated (contained or exhausted). */
  CascadeEnded: 'CascadeEnded',

  /** A zone became (re)energised. */
  ZonePowered: 'ZonePowered',
  /** A zone lost power. */
  ZoneBlackout: 'ZoneBlackout',

  /** The simulation is requesting an operator decision. */
  DecisionRequested: 'DecisionRequested',
  /** An operator decision was committed to the simulation. */
  DecisionCommitted: 'DecisionCommitted',

  /** The learner model updated its estimates. */
  LearningUpdated: 'LearningUpdated',

  /** Replay playback started. */
  ReplayStarted: 'ReplayStarted',
  /** Replay playback finished. */
  ReplayFinished: 'ReplayFinished',

  /** The run reached a terminal outcome. */
  GameEnded: 'GameEnded',
} as const;

/** Union of all valid event names. */
export type GridEventName = (typeof GRID_EVENT)[keyof typeof GRID_EVENT];
