/**
 * `@infra` — System F, Infrastructure. The composition root and app bootstrap,
 * plus concrete cross-cutting services (console logger, JSON serializer). This
 * is the ONLY layer permitted to import every other layer — it wires them
 * together. Nothing depends on infrastructure except the app entry point.
 */
export * from './logging/console-logger';
export * from './serialization/json-serializer';
export * from './di/composition-root';
export * from './bootstrap/bootstrap';
