/**
 * HomesPowered — the stake, in the one unit nobody needs explaining.
 *
 * Megawatts are the operator's unit; households are everybody else's. This sits
 * in the command bar and turns unserved demand into the number the shift is
 * actually about — and it TICKS DOWN when a district goes dark, which is the
 * moment the abstraction stops being abstract.
 *
 * The count animates toward its target rather than snapping. Not decoration:
 * a figure that jumps from 220,000 to 178,000 between two frames reads as a
 * glitch, while a fast count-down reads as loss, which is what it is.
 */
import { useGridStore } from '@state';
import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { Tooltip } from '../common/Tooltip';
import type { CrisisLevelStyle } from '../crisis';

import { MERIDIAN_BAY_HOUSEHOLDS, estimateHouseholdsPowered } from './learning-copy';

/** Fraction of the remaining gap closed per frame. ~0.4 s to settle. */
const EASE = 0.18;
/** Below this many homes of difference, snap — no visible crawl at the end. */
const SNAP = 40;

export function HomesPowered({ style }: { style: CrisisLevelStyle }): ReactElement | null {
  const zones = useGridStore((s) => s.zones);

  const unservedMw = zones.reduce((sum, zone) => sum + (zone.unservedLoad as number), 0);
  const target = estimateHouseholdsPowered(unservedMw);

  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const step = (): void => {
      const gap = target - shownRef.current;
      if (Math.abs(gap) < SNAP) {
        shownRef.current = target;
        setShown(target);
        frame.current = null;
        return;
      }
      shownRef.current += gap * EASE;
      setShown(Math.round(shownRef.current));
      frame.current = requestAnimationFrame(step);
    };

    frame.current ??= requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    };
  }, [target]);

  if (zones.length === 0) return null;

  const lost = MERIDIAN_BAY_HOUSEHOLDS - target;
  const color = lost === 0 ? style.accent : lost > 20_000 ? '#F1544B' : '#B4531F';

  return (
    <Tooltip
      title="Homes powered"
      content={
        lost === 0
          ? `All ${MERIDIAN_BAY_HOUSEHOLDS.toLocaleString()} households in Meridian Bay have power. Estimated at ~800 homes per MW of unserved demand.`
          : `≈${lost.toLocaleString()} households are without power right now — ${String(Math.round(unservedMw))} MW of demand the grid is not serving. Estimated at ~800 homes per MW.`
      }
      position="bottom"
    >
      <span
        className="console-value"
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 5,
          fontSize: 11,
          fontWeight: 700,
          color: lost === 0 && style.label === 'BLACKOUT' ? style.barInk : color,
          background: style.barWell,
          border: `1px solid ${style.barWellBorder}`,
          borderRadius: 6,
          padding: '4px 10px',
          whiteSpace: 'nowrap',
          cursor: 'help',
          transition: 'color 300ms ease',
        }}
      >
        <span>{shown.toLocaleString()}</span>
        <span style={{ fontSize: 9.5, color: style.barInkMuted, letterSpacing: '0.06em' }}>
          HOMES
        </span>
      </span>
    </Tooltip>
  );
}
