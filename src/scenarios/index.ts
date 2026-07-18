/**
 * `@scenarios` — the plugin crisis-scenario layer. Defines the
 * `ICrisisScenario` contract and a registry, plus concrete scenario plugins.
 * Scenarios depend on the engine; the engine never depends on scenarios.
 */
export * from './crisis-scenario';
export * from './scenario-registry';
export * from './heatwave/heatwave-scenario';
