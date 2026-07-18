import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { PROFILES, resolveProfile } from '@config';
import { bootstrap } from '@infra';

import { App } from './App';
import './index.css';

// Resolve the runtime profile (VITE_PROFILE env, default development) and the
// matching configuration, then bootstrap the simulation runtime.
const profile = resolveProfile(import.meta.env['VITE_PROFILE'] as string | undefined);
const config = PROFILES[profile];
const runtime = bootstrap(config);

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('GridGuard: root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App config={config} />
  </StrictMode>,
);

// Tear the runtime down cleanly when the tab closes.
window.addEventListener('beforeunload', () => {
  runtime.shutdown();
});
