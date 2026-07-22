/**
 * `@audio` — System E, the Audio Engine. Adaptive music, ambient beds, SFX, and
 * dynamic mixing behind a facade. Simulation emits events; audio reacts. A
 * consumer: it never drives or queries the simulation.
 */
export * from './audio-engine';
export * from './music/adaptive-music';
export * from './ambient/ambient-layer';
export * from './sfx/sfx-player';
export * from './mixing/mixer';
export * from './web-audio-director';
