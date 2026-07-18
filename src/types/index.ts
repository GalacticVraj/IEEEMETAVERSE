/**
 * `@app-types` — cross-cutting, dependency-free type vocabulary.
 *
 * This is a pure LEAF module: it imports nothing and may be imported by every
 * layer. It defines branded ids, physical units, and domain enumerations only.
 * No behavior lives here.
 */
export type { Brand } from './brand';
export * from './ids';
export * from './units';
export * from './enums';
export * from './kernel-state';
