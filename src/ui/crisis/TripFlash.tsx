/**
 * TripFlash.tsx — the arc-flash moment when a generating unit is lost.
 *
 * A 380 ms full-screen bloom: up in 80 ms, gone in 300 ms. Losing 400 MW is
 * the single most consequential thing that happens in a run, and until now it
 * announced itself with a number quietly changing in the rail. This is the
 * "something just happened" that makes the player look up.
 *
 * It lives in the DOM overlay rather than in `visual-effects/event-flashes`
 * (where the brief put it) for one reason: the in-canvas effect is positional
 * — it marks WHERE the fault was, and it is clipped to the 3D viewport. This
 * one is non-positional and must cover the console too. They are complements,
 * and both fire for the same event.
 *
 * Cause is traceable per doctrine: the trigger is a `critical` generator entry
 * in the event log, which is a projection of the engine's own per-generator
 * trip transition. There is no timer path that can fire this.
 *
 * Motion is a CSS animation on purpose, so the global `prefers-reduced-motion`
 * rule in `index.css` removes it — and because the base opacity is 0, removing
 * the animation removes the flash entirely rather than leaving a white sheet
 * pinned over the city.
 */
import { useEventLogStore } from '@state';
import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

/** Must match the `tripFlash` keyframes in `index.css`. */
const FLASH_MS = 380;

export function TripFlash(): ReactElement | null {
  const [pulse, setPulse] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let lastSeen = useEventLogStore.getState().entries.at(-1)?.seq ?? 0;

    const unsubscribe = useEventLogStore.subscribe((state) => {
      const latest = state.entries.at(-1);
      if (latest === undefined) return;
      // A restart rewinds the log; re-arm rather than going silent forever.
      if (latest.seq < lastSeen) lastSeen = 0;
      if (latest.seq <= lastSeen) return;
      lastSeen = latest.seq;

      if (latest.focus?.kind !== 'generator' || latest.severity !== 'critical') return;

      // The seq is the key, so back-to-back losses in a cascade retrigger the
      // animation instead of the second one being swallowed as "no change".
      setPulse(latest.seq);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setPulse(0);
      }, FLASH_MS);
    });

    return () => {
      unsubscribe();
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  if (pulse === 0) return null;

  return <div key={pulse} aria-hidden className="trip-flash" />;
}
