/**
 * `@constants` — named constants and the canonical event-name registry.
 *
 * Pure leaf module (imports only `@app-types`). Exists so that no magic number
 * or anonymous event-name string ever appears elsewhere in the codebase.
 */
export * from './events';
export * from './simulation';
