/**
 * `@ui` — System D, the User Interface. HUD, decision wheel, timeline, replay
 * controls, settings, and accessibility helpers, plus the Phase-1 foundation
 * screen. A consumer: reads projections and emits intents onto the bus. Never
 * owns simulation state.
 */
export * from './app-shell';
export * from './foundation/foundation-screen';
export * from './hud/hud';
export * from './decision-wheel/decision-wheel';
export * from './timeline/timeline-bar';
export * from './replay-controls/replay-controls';
export * from './settings/settings-panel';
export * from './accessibility/a11y';
