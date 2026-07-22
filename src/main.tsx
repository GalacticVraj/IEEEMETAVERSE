import { createRoot } from 'react-dom/client';

import { createAudioDirector } from '@audio';
import { PROFILES, resolveProfile } from '@config';
import { EVENT_BUS } from '@core';
import { bootstrap } from '@infra';
import { bindAppFlow } from '@state';

import { useCameraStore } from './rendering/camera/camera-store';

import { App } from './App';
import './index.css';
import { RuntimeContext } from './runtime-context';

// Resolve the runtime profile and bootstrap the full simulation runtime.
const profile = resolveProfile(import.meta.env['VITE_PROFILE'] as string | undefined);
const config = PROFILES[profile];
const runtime = bootstrap(config);

// Route terminal simulation outcomes (GameEnded) into the app flow.
bindAppFlow(runtime.container.resolve(EVENT_BUS), runtime.session);

// Synthesized audio layer — reacts to real events; starts on first gesture.
const audio = createAudioDirector(runtime.container.resolve(EVENT_BUS));
audio.start();

// Accessibility: respect reduced-motion — no auto camera moves, no intro
// flight (public store API only; the camera system itself is untouched).
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  useCameraStore.setState({ autoFollow: false, introDone: true });
}

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
