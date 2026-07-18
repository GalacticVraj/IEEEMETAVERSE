import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Vite configuration for GridGuard.
 *
 * Path aliases are NOT duplicated here — `vite-tsconfig-paths` reads them from
 * `tsconfig.base.json`, keeping a single source of truth for module aliases
 * shared by the compiler, the bundler, and Vitest.
 */
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  build: {
    target: 'es2022',
    sourcemap: true,
    outDir: 'dist',
  },
  server: {
    port: 5173,
    open: false,
  },
});
