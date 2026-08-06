/**
 * Reveal — progressive disclosure wrapper for a console region.
 *
 * Hides its children until the tutorial discloses that panel, then slides them
 * in from the given edge. Outside the tutorial (ActiveCrisis, AfterAction, or
 * any player who has already completed onboarding) everything is visible, so
 * this is inert in the normal operating case.
 *
 * Motion: `index.css` already kills every transition under
 * `prefers-reduced-motion: reduce` with `!important`, so nothing here may
 * depend on a `transitionend` firing — visibility is sequenced with a CSS
 * transition delay instead of a JS callback, and simply snaps when motion is
 * disabled.
 */
import { useTutorialStore } from '@state';
import type { PanelId } from '@state';
import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

export type RevealFrom = 'left' | 'right' | 'top' | 'bottom';

const OFFSCREEN: Record<RevealFrom, string> = {
  left: 'translateX(-28px)',
  right: 'translateX(28px)',
  top: 'translateY(-14px)',
  bottom: 'translateY(28px)',
};

const SHOW_TRANSITION =
  'opacity 420ms ease, transform 420ms cubic-bezier(0.16, 1, 0.3, 1), visibility 0s';
const HIDE_TRANSITION = 'opacity 240ms ease, transform 240ms ease, visibility 0s linear 240ms';

export interface RevealProps {
  readonly id: PanelId;
  readonly from: RevealFrom;
  readonly children: ReactNode;
  readonly style?: CSSProperties;
}

export function Reveal({ id, from, children, style }: RevealProps): ReactElement {
  const teaching = useTutorialStore((s) => s.active);
  const disclosed = useTutorialStore((s) => s.revealed.has(id));
  const ref = useRef<HTMLDivElement>(null);
  const announced = useRef(false);

  // Only the tutorial withholds panels. Everywhere else the console is whole.
  const visible = !teaching || disclosed;

  // A panel that arrives below the fold is a panel the player can't see Davis
  // pointing at. When teaching, bring each newly disclosed panel into view —
  // once per panel, and never during ordinary play.
  useEffect(() => {
    if (!teaching || !disclosed || announced.current) return;
    announced.current = true;
    const at = ref.current;
    if (at === null) return;
    const timer = setTimeout(
      () => at.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      120,
    );
    return () => clearTimeout(timer);
  }, [teaching, disclosed]);

  return (
    <div
      ref={ref}
      aria-hidden={!visible}
      data-panel={id}
      data-revealed={visible ? 'true' : 'false'}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : OFFSCREEN[from],
        visibility: visible ? 'visible' : 'hidden',
        pointerEvents: visible ? 'auto' : 'none',
        transition: visible ? SHOW_TRANSITION : HIDE_TRANSITION,
      }}
    >
      {children}
    </div>
  );
}
