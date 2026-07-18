import type { Brand } from './brand';

/**
 * Strongly-typed entity identifiers. Each is a branded string so the compiler
 * rejects passing (for example) a `ZoneId` where a `LineId` is expected.
 *
 * These are DATA identifiers for the electrical model. See {@link SystemId} for
 * the identifier used by the kernel's system registry.
 */
export type NodeId = Brand<string, 'NodeId'>;
export type LineId = Brand<string, 'LineId'>;
export type ZoneId = Brand<string, 'ZoneId'>;
export type GeneratorId = Brand<string, 'GeneratorId'>;
export type LoadId = Brand<string, 'LoadId'>;
export type ScenarioId = Brand<string, 'ScenarioId'>;
export type DecisionId = Brand<string, 'DecisionId'>;
export type SnapshotId = Brand<string, 'SnapshotId'>;

/** Identifier for a kernel-registered simulation system (weather, cascade, …). */
export type SystemId = Brand<string, 'SystemId'>;

export const asNodeId = (value: string): NodeId => value as NodeId;
export const asLineId = (value: string): LineId => value as LineId;
export const asZoneId = (value: string): ZoneId => value as ZoneId;
export const asGeneratorId = (value: string): GeneratorId => value as GeneratorId;
export const asLoadId = (value: string): LoadId => value as LoadId;
export const asScenarioId = (value: string): ScenarioId => value as ScenarioId;
export const asDecisionId = (value: string): DecisionId => value as DecisionId;
export const asSnapshotId = (value: string): SnapshotId => value as SnapshotId;
export const asSystemId = (value: string): SystemId => value as SystemId;
