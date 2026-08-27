/**
 * CrisisVignette.tsx — the room's own alarm lamp.
 *
 * An inset glow around the edge of the screen while the grid is CRITICAL or in
 * BLACKOUT. It is peripheral on purpose: the player's eyes belong on the city
 * and the rail, and an alarm that covers either of those is a worse alarm.
 *
 * Traceable cause, per doctrine: this is on if and only if the crisis ladder
 * says critical or blackout, and both of those are measured — a frequency
 * excursion, a corridor at 95 % of rating, a trip, automatic shedding, or a
 * de-energized district. It cannot fire on a timer.
 *
 * `prefers-reduced-motion` is handled globally in `index.css`, which kills the
 * animation outright; the static styles below are therefore the reduced-motion
 * appearance, and they still read as an alarm.
 */
import type { ReactElement } from 'react';

import { useCrisisAssessment } from './use-crisis-level';

export function CrisisVignette(): ReactElement | null {
  const { level } = useCrisisAssessment();

  if (level !== 'critical' && level !== 'blackout') return null;

  // Blackout sits deeper and steadier: by then the alarm is not news, and the
  // console has already gone dark to say so.
  const blackout = level === 'blackout';

  return (
    <div
      aria-hidden
      className="crisis-vignette"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 35,
        boxShadow: blackout
          ? 'inset 0 0 220px 40px rgba(179, 38, 30, 0.30)'
          : 'inset 0 0 170px 24px rgba(179, 38, 30, 0.24)',
        animationDuration: blackout ? '2.6s' : '1.8s',
      }}
    />
  );
}
