import { describe, expect, it } from 'vitest';

import { createConfigService, resolveProfile } from './config-service';

describe('config', () => {
  it('resolves known profiles', () => {
    expect(resolveProfile('competition')).toBe('competition');
    expect(resolveProfile('demo')).toBe('demo');
  });

  it('defaults unknown or missing profiles to development', () => {
    expect(resolveProfile(undefined)).toBe('development');
    expect(resolveProfile('nonsense')).toBe('development');
  });

  it('exposes the resolved config for a profile', () => {
    const service = createConfigService('competition');
    expect(service.profile()).toBe('competition');
    expect(service.get().profile).toBe('competition');
    expect(service.get().debug.overlay).toBe(false);
  });
});
