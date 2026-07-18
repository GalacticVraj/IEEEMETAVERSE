/**
 * Structured logging contract. The pure layers accept an injected `Logger`
 * rather than touching `console` (which is not even in scope for the
 * engine-standalone build). Concrete sinks live in `@infra/logging`.
 */
export type LogMeta = Readonly<Record<string, unknown>>;

export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, error?: unknown, meta?: LogMeta): void;
  /** Create a child logger that tags all messages with `scope`. */
  child(scope: string): Logger;
}

/**
 * A logger that discards everything. Safe default for pure code and tests so
 * that "no logger provided" never means "reach for console".
 */
export const NoopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => NoopLogger,
};
