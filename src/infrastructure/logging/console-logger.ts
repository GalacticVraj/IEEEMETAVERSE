/* eslint-disable no-console -- this module IS the console logging sink */
import type { LogLevel } from '@config';
import type { LogMeta, Logger } from '@core';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Concrete {@link Logger} backed by the browser console, with level filtering
 * and scope tagging. This is the ONLY place `console` is used in the app — the
 * pure layers accept an injected `Logger` instead.
 */
export function createConsoleLogger(minLevel: LogLevel = 'debug', scope = 'app'): Logger {
  const enabled = (level: LogLevel): boolean => LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
  const tag = `[${scope}]`;

  return {
    debug(message: string, meta?: LogMeta): void {
      if (enabled('debug')) console.debug(tag, message, meta ?? '');
    },
    info(message: string, meta?: LogMeta): void {
      if (enabled('info')) console.info(tag, message, meta ?? '');
    },
    warn(message: string, meta?: LogMeta): void {
      if (enabled('warn')) console.warn(tag, message, meta ?? '');
    },
    error(message: string, error?: unknown, meta?: LogMeta): void {
      if (enabled('error')) console.error(tag, message, error ?? '', meta ?? '');
    },
    child(childScope: string): Logger {
      return createConsoleLogger(minLevel, `${scope}:${childScope}`);
    },
  };
}
