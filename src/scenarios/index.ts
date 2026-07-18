/**
 * `@scenarios` — the plugin crisis-scenario layer. Defines the
 * `ICrisisScenario` contract and a registry, plus concrete scenario plugins.
 * Scenarios depend on the engine; the engine never depends on scenarios.
 */
export * from './crisis-scenario';
export * from './scenario-registry';
export * from './heatwave/heatwave-scenario';
export * from './storm/storm-scenario';
export * from './equipment-failure/equipment-failure-scenario';
export * from './cyber-attack/cyber-attack-scenario';
export * from './generator-loss/generator-loss-scenario';
export * from './substation-failure/substation-failure-scenario';
export * from './demand-surge/demand-surge-scenario';
export * from './transformer-failure/transformer-failure-scenario';
