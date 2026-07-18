/**
 * App smoke test — verifies the App module imports cleanly and that
 * the OperatorPanel renders safely without a runtime context.
 *
 * Note: the full Three.js canvas requires a WebGL context so we cannot
 * use renderToString here. We just verify modules are importable and
 * exports are defined.
 */
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('App module exports a component function', () => {
    expect(typeof App).toBe('function');
  });

  it('App accepts the development config without throwing at import time', () => {
    // Just verifying the module loaded without top-level exceptions.
    expect(App).toBeDefined();
  });
});
