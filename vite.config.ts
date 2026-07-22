import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Vite configuration for GridGuard.
 *
 * Path aliases are NOT duplicated here — `vite-tsconfig-paths` reads them from
 * `tsconfig.base.json`, keeping a single source of truth for module aliases
 * shared by the compiler, the bundler, and Vitest.
 */

/**
 * Dev-only middleware that serves the SAME `/api/advisor` edge handler Vercel
 * runs in production, so the Gemini proxy works on localhost when a
 * GEMINI_API_KEY is present in `.env.local`. Without a key the handler
 * returns its normal error and the client falls back to deterministic text —
 * exactly the production degradation path.
 */
function advisorDevProxy(): Plugin {
  return {
    name: 'gridguard-advisor-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/advisor', (req, res) => {
        void (async () => {
          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const body = Buffer.concat(chunks).toString('utf-8');

            const module = (await server.ssrLoadModule('/api/advisor.ts')) as {
              default: (req: Request) => Promise<Response>;
            };
            const handler = module.default;
            const init: RequestInit = {
              method: req.method ?? 'POST',
              headers: { 'Content-Type': 'application/json' },
            };
            if (body.length > 0) init.body = body;
            const request = new Request('http://localhost/api/advisor', init);
            const response = await handler(request);

            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            res.end(await response.text());
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'dev_proxy_error', message: String(error) }));
          }
        })();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Surface GEMINI_API_KEY from .env.local to the dev proxy handler.
  const env = loadEnv(mode, process.cwd(), '');
  if (env['GEMINI_API_KEY'] !== undefined && process.env['GEMINI_API_KEY'] === undefined) {
    process.env['GEMINI_API_KEY'] = env['GEMINI_API_KEY'];
  }

  return {
    plugins: [react(), tsconfigPaths(), advisorDevProxy()],
    build: {
      target: 'es2022',
      sourcemap: true,
      outDir: 'dist',
    },
    server: {
      port: 5173,
      open: false,
    },
  };
});
