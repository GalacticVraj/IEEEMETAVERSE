import { createToken } from './di/container';
import type { Token } from './di/container';
import type { GridEventBus } from './events/grid-events';
import type { Logger } from './logging/logger';
import type { Serializer } from './serialization/serializer';

/**
 * DI tokens for the core cross-cutting services. Tokens live with their
 * interface so any module can reference them without importing an implementation.
 */
export const LOGGER: Token<Logger> = createToken('Logger');
export const SERIALIZER: Token<Serializer> = createToken('Serializer');
export const EVENT_BUS: Token<GridEventBus> = createToken('EventBus');
