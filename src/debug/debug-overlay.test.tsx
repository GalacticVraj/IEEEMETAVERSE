/**
 * The developer overlay's defining failure was that it could not be got rid
 * of. It opens COLLAPSED as a small "DEBUG" pill whose only affordance was
 * "click to expand" — the sole way to dismiss it was Ctrl+Shift+D, which a
 * user has no way to discover. So it sat on screen permanently.
 *
 * Client render under jsdom, never renderToStaticMarkup: Zustand v5 hands
 * React `getInitialState` as the server snapshot, so a server render would
 * always see the store's initial value.
 */
// @vitest-environment jsdom
import { useUiStore } from '@state';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DebugOverlay } from './debug-overlay';

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
  useUiStore.setState({ debugOverlayVisible: true });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useUiStore.setState({ debugOverlayVisible: false });
});

const render = (): void => {
  act(() => {
    root.render(<DebugOverlay seed={1} />);
  });
};

/** Every control the overlay exposes, by accessible label. */
const controlLabels = (): string[] =>
  [...container.querySelectorAll('button,[role="button"],[title],[aria-label]')].map(
    (el) => el.getAttribute('aria-label') ?? el.getAttribute('title') ?? '',
  );

describe('DebugOverlay dismissal', () => {
  it('offers a visible close control while collapsed', () => {
    render();
    const labels = controlLabels().join(' | ').toLowerCase();
    expect(labels).toMatch(/close|dismiss|hide/);
  });

  it('closes when that control is clicked, without needing a keyboard chord', () => {
    render();
    const close = container.querySelector<HTMLElement>('[aria-label*="Close" i]');
    expect(close, 'no close control rendered').not.toBeNull();

    act(() => close!.click());

    expect(useUiStore.getState().debugOverlayVisible).toBe(false);
  });

  it('still offers a close control once expanded', () => {
    render();
    const expand = container.querySelector<HTMLElement>('[title*="expand" i]');
    if (expand !== null) act(() => expand.click());

    const close = container.querySelector<HTMLElement>('[aria-label*="Close" i]');
    expect(close, 'expanded panel has no close control').not.toBeNull();

    act(() => close!.click());
    expect(useUiStore.getState().debugOverlayVisible).toBe(false);
  });
});
