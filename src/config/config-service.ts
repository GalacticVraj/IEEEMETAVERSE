import { createToken } from '@core';
import type { Token } from '@core';

import { PROFILES } from './profiles';
import type { AppConfig, AppProfile } from './schema';

/** Read-only access to the resolved application configuration. */
export interface IConfigService {
  get(): AppConfig;
  profile(): AppProfile;
}

export const CONFIG_SERVICE: Token<IConfigService> = createToken('ConfigService');

const KNOWN_PROFILES: readonly AppProfile[] = ['development', 'demo', 'production', 'competition'];

/**
 * Map a raw string (e.g. an env var) to a valid {@link AppProfile}, defaulting
 * to `development` when unset or unrecognized. Deterministic and testable.
 */
export function resolveProfile(raw: string | undefined): AppProfile {
  return KNOWN_PROFILES.find((profile) => profile === raw) ?? 'development';
}

/** Create a config service bound to a resolved profile. */
export function createConfigService(profile: AppProfile): IConfigService {
  const config = PROFILES[profile];
  return {
    get: () => config,
    profile: () => profile,
  };
}
