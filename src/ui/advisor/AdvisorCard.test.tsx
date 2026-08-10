/**
 * The in-play mentor is Chief Engineer Davis — the same person who ran the
 * shift handover. These tests pin the two things that matter about that:
 * he is identifiable, and personifying him did not touch the message itself.
 *
 * NOTE ON RENDERING: this must be a CLIENT render under jsdom, never
 * `renderToStaticMarkup`. Zustand v5 hands React `getInitialState` as the
 * server snapshot, so a server render always sees the store's initial value
 * and would report an empty card no matter what the test sets up.
 */
// @vitest-environment jsdom
import { useAdvisorStore } from '@state';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AdvisorCard } from './AdvisorCard';

const EVIDENCE_TEXT = 'Harbor unit tripped — 180 MW of generation left the grid in one step.';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useAdvisorStore.setState({ current: null });
});

/**
 * Render the card with the advisor holding `current`, return the markup.
 * The store write goes INSIDE act: once the card is mounted it is subscribed,
 * so a bare setState would update it outside React's batching and warn.
 */
function renderWith(current: { id: number; kind: string; text: string } | null): string {
  act(() => {
    useAdvisorStore.setState({ current: current as never });
    root.render(<AdvisorCard />);
  });
  return container.innerHTML;
}

describe('AdvisorCard', () => {
  it('renders nothing when the advisor has nothing evidence-backed to say', () => {
    expect(renderWith(null)).toBe('');
  });

  it('delivers the advisory as Davis on channel one', () => {
    const html = renderWith({ id: 1, kind: 'explanation', text: EVIDENCE_TEXT });
    expect(html).toContain('DAVIS');
    expect(html).toContain('CH.01');
    expect(html).toContain('<svg'); // the portrait, drawn in code
  });

  it('passes the advisor message through verbatim', () => {
    // The persona is presentation only. If personifying the card ever starts
    // rewriting, truncating or decorating the evidence text, that is a
    // doctrine violation and this test is what catches it.
    expect(renderWith({ id: 2, kind: 'feedback', text: EVIDENCE_TEXT })).toContain(EVIDENCE_TEXT);
  });

  it('keeps a distinct label for every advisory kind', () => {
    const labels = new Set<string>();
    for (const kind of ['question', 'explanation', 'reinforcement', 'feedback']) {
      const html = renderWith({ id: 3, kind, text: EVIDENCE_TEXT });
      const match = /THINK AHEAD|WHAT JUST HAPPENED|WELL HELD|MEASURED RESULT/.exec(html);
      expect(match, `no label rendered for kind "${kind}"`).not.toBeNull();
      labels.add(match![0]);
    }
    expect(labels.size).toBe(4);
  });
});
