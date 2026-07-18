import type { ReactElement } from 'react';

import type { AppConfig } from '@config';
import { DebugOverlay } from '@debug';
import { RenderRoot } from '@rendering';
import { AppShell, FoundationScreen } from '@ui';

export interface AppProps {
  readonly config: AppConfig;
}

/**
 * Application root. Composes the three visual consumers over the simulation:
 * the 3D presentation root, the DOM UI overlay, and (in dev) the debug overlay.
 * The Phase-1 foundation screen stands in for gameplay UI. All of these READ
 * from projections/events — none computes simulation state.
 */
export function App({ config }: AppProps): ReactElement {
  return (
    <>
      <RenderRoot />
      <FoundationScreen profile={config.profile} seed={config.simulation.seed} />
      <AppShell />
      {config.debug.overlay ? <DebugOverlay seed={config.simulation.seed} /> : null}
    </>
  );
}
