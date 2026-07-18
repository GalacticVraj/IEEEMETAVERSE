/**
 * `@config` — every configurable parameter, organized into development / demo /
 * production / competition profiles. No hardcoded tunables live outside this
 * module. Loaded by `@infra` and injected; the pure layers never import it.
 */
export * from './schema';
export * from './profiles';
export * from './config-service';
