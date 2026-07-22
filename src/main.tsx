import { createRoot } from 'react-dom/client';

import { PROFILES, resolveProfile } from '@config';
import { EVENT_BUS } from '@core';
import { bootstrap } from '@infra';
import { bindAppFlow } from '@state';

import { App } from './App';
import './index.css';
import { RuntimeContext } from './runtime-context';

// Resolve the runtime profile and bootstrap the full simulation runtime.
const profile = resolveProfile(import.meta.env['VITE_PROFILE'] as string | undefined);
const config = PROFILES[profile];
const runtime = bootstrap(config);

// Route terminal simulation outcomes (GameEnded) into the app flow.
bindAppFlow(runtime.container.resolve(EVENT_BUS), runtime.session);

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('GridGuard: root element #root not found');
}

createRoot(rootElement).render(
  <RuntimeContext.Provider value={runtime}>
    <App config={config} />
  </RuntimeContext.Provider>,
);

// Tear the runtime down cleanly when the tab closes.
window.addEventListener('beforeunload', () => {
  runtime.shutdown();
});
