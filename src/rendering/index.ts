/**
 * `@rendering` — System C, Presentation. Split into `scene-graph` (structural
 * world: city, camera, lighting) and `visual-effects` (post-processing,
 * particles, event-triggered animation) so the layer never becomes a monolith.
 *
 * A PURE CONSUMER: it reads simulation projections and reacts to events. It may
 * never compute, infer, cache, or modify authoritative simulation state, and it
 * never imports `@engine` or `@kernel`.
 */
export * from './scene-graph';
export * from './visual-effects';
export * from './render-root';
