import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

/**
 * Vitest configuration, layered on top of the Vite config so aliases and
 * plugins stay identical between the app and the test runner.
 *
 * Default environment is `node` — the deterministic kernel needs no DOM. Files
 * that require a DOM opt in per-file with `// @vitest-environment jsdom`.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.{test,spec}.{ts,tsx}',
          'src/**/index.ts',
          'src/**/*.d.ts',
          'src/main.tsx',
          'src/App.tsx',
        ],
        // Phase 1 proves the harness against the deterministic kernel (RNG,
        // Clock, EventBus, DI, FSM). The >90% engine target ramps up as real
        // physics lands — see docs/architecture/12-testing-strategy.md.
        thresholds: {
          lines: 0,
          functions: 0,
          branches: 0,
          statements: 0,
        },
      },
    },
  }),
);
