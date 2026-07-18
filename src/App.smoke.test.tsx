import { PROFILES } from '@config';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App';

/**
 * Render smoke test: renders the whole app tree to a string. Catches runtime
 * errors in the component graph (foundation screen, render root, HUD shell,
 * debug overlay reading the projection store) without needing a browser.
 */
describe('App', () => {
  it('renders the Phase-1 foundation console without throwing', () => {
    const html = renderToString(<App config={PROFILES.development} />);
    expect(html).toContain('GridGuard');
    expect(html).toContain('Foundation online');
    expect(html).toContain('Simulation Engine');
  });

  it('omits the debug overlay when the profile disables it', () => {
    const html = renderToString(<App config={PROFILES.competition} />);
    expect(html).toContain('GridGuard');
    expect(html).not.toContain('GridGuard · Debug');
  });
});
