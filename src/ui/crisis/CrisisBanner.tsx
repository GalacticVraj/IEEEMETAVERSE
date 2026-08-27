/**
 * CrisisBanner.tsx — the alert stack, and the escalation watcher that feeds it.
 *
 * A banner appears when the grid gets WORSE, never when it merely stays bad
 * and never on a recovery back down the ladder — the ladder's `escalated`
 * predicate is the whole gate. Each banner quotes the measured reading that
 * caused the escalation, so the player learns which instrument to watch, not
 * merely that something happened.
 *
 * Styling follows the daylight console: tinted paper with a semantic accent
 * edge. The one banner that inverts is `blackout`, matching the command bar,
 * which goes dark for the same reason the districts did.
 */
import { useEventLogStore } from '@state';
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';

import { CRISIS_LEVEL_STYLE, escalated } from './crisis-level';
import type { CrisisLevel } from './crisis-level';
import { useBannerStore } from './banner-store';
import type { Banner, BannerTone } from './banner-store';
import { useCrisisAssessment } from './use-crisis-level';

interface ToneStyle {
  readonly accent: string;
  readonly surface: string;
  readonly ink: string;
  readonly inkMuted: string;
  readonly border: string;
}

const TONE: Readonly<Record<BannerTone, ToneStyle>> = {
  info: {
    accent: '#22637E',
    surface: 'rgba(250, 250, 247, 0.97)',
    ink: '#1C2530',
    inkMuted: '#5A6774',
    border: 'rgba(34, 99, 126, 0.35)',
  },
  recovery: {
    accent: '#217A56',
    surface: 'rgba(243, 250, 246, 0.97)',
    ink: '#1C2530',
    inkMuted: '#4A6559',
    border: 'rgba(33, 122, 86, 0.35)',
  },
  warning: {
    accent: '#B4531F',
    surface: 'rgba(253, 246, 238, 0.97)',
    ink: '#1C2530',
    inkMuted: '#6B5744',
    border: 'rgba(180, 83, 31, 0.4)',
  },
  critical: {
    accent: '#B3261E',
    surface: 'rgba(253, 240, 238, 0.97)',
    ink: '#1C2530',
    inkMuted: '#6E4B47',
    border: 'rgba(179, 38, 30, 0.45)',
  },
  blackout: {
    accent: '#F1544B',
    surface: 'rgba(28, 37, 48, 0.96)',
    ink: '#FAFAF7',
    inkMuted: '#A7B2BC',
    border: 'rgba(179, 38, 30, 0.7)',
  },
};

/** Level → banner tone. `standby` and `normal` never raise an alert. */
const LEVEL_TONE: Readonly<Record<CrisisLevel, BannerTone | null>> = {
  standby: null,
  normal: null,
  warning: 'warning',
  critical: 'critical',
  blackout: 'blackout',
};

function BannerCard({
  banner,
  onDismiss,
}: {
  banner: Banner;
  onDismiss: () => void;
}): ReactElement {
  const tone = TONE[banner.tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-slide-down"
      onClick={onDismiss}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: 'min(560px, calc(100vw - 40px))',
        padding: '9px 14px',
        background: tone.surface,
        border: `1px solid ${tone.border}`,
        borderLeft: `4px solid ${tone.accent}`,
        borderRadius: 8,
        boxShadow: '0 8px 24px -4px rgba(28, 37, 48, 0.18), 0 2px 6px rgba(28, 37, 48, 0.08)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        pointerEvents: 'auto',
        cursor: 'pointer',
      }}
      title="Dismiss"
    >
      <span
        className="status-led"
        style={{ background: tone.accent, marginTop: 5, flex: 'none' }}
        aria-hidden
      />
      <div style={{ minWidth: 0 }}>
        <div
          className="console-section-title"
          style={{ color: tone.accent, fontSize: 10.5, marginBottom: 1 }}
        >
          {banner.title}
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.4, color: tone.ink }}>{banner.detail}</div>
      </div>
    </div>
  );
}

/**
 * Watches the ladder and raises one banner per upward step.
 *
 * The previous level is held in a ref rather than state: this must not itself
 * cause a render, and it must survive the every-tick re-evaluation of the
 * assessment without treating each tick as a fresh escalation.
 */
function useEscalationBanners(): void {
  const { level, reason } = useCrisisAssessment();
  const push = useBannerStore((s) => s.push);
  const previous = useRef<CrisisLevel>('standby');

  useEffect(() => {
    const from = previous.current;
    previous.current = level;

    // Returning to standby means a new run is being set up — re-arm silently.
    if (level === 'standby') return;
    if (!escalated(from, level)) return;

    const tone = LEVEL_TONE[level];
    if (tone === null) return;

    push({
      tone,
      title: CRISIS_LEVEL_STYLE[level].label,
      detail: reason,
      // One banner per level per escalation: if the grid drops back and climbs
      // again the key is free, but flapping inside a level cannot re-fire.
      dedupeKey: `level:${level}`,
    });
  }, [level, reason, push]);
}

/**
 * Raises a banner for the individual events that deserve one.
 *
 * The escalation watcher above answers "how bad is it overall"; this answers
 * "what just happened". Both are needed: a second generator tripping while
 * already CRITICAL does not move the ladder, but it is absolutely news.
 *
 * The source is the event log, which is a projection of real bus events, and
 * each banner carries the log entry's own measured detail. There is no path
 * here that can fire without something having happened in the simulation.
 */
function useEventBanners(): void {
  const push = useBannerStore((s) => s.push);

  useEffect(() => {
    let lastSeen = useEventLogStore.getState().entries.at(-1)?.seq ?? 0;

    return useEventLogStore.subscribe((state) => {
      const latest = state.entries.at(-1);
      if (latest === undefined) return;
      // A restart rewinds the log; re-arm rather than going silent forever.
      if (latest.seq < lastSeen) lastSeen = 0;
      if (latest.seq <= lastSeen) return;
      lastSeen = latest.seq;

      // Routine chatter never becomes a banner. Only losses, outages and
      // recoveries — the events an operator would be told about out loud.
      const kind = latest.focus?.kind;
      const isLoss = latest.severity === 'critical';
      const isRecovery = latest.severity === 'recovery';
      if (!isLoss && !isRecovery) return;
      if (kind !== 'generator' && kind !== 'zone' && kind !== 'line' && kind !== 'city') return;

      push({
        tone: isRecovery ? 'recovery' : kind === 'zone' ? 'blackout' : 'critical',
        title: latest.title.toUpperCase(),
        detail: latest.detail.length > 0 ? latest.detail : latest.what,
        // Keyed by the asset, so one flapping corridor refreshes its own
        // banner instead of filling the stack with three copies of itself.
        dedupeKey: `event:${kind}:${latest.focus?.id ?? 'city'}:${isRecovery ? 'up' : 'down'}`,
      });
    });
  }, [push]);
}

/**
 * The banner stack. Mount once, near the top of the overlay tree.
 *
 * Sits below the 48px command bar and above the city, horizontally centred on
 * the open middle of the screen — the one region the console shell
 * deliberately leaves empty.
 */
export function CrisisBanners(): ReactElement | null {
  useEscalationBanners();
  useEventBanners();
  const banners = useBannerStore((s) => s.banners);
  const dismiss = useBannerStore((s) => s.dismiss);

  if (banners.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 58,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
        zIndex: 40,
      }}
    >
      {banners.map((banner) => (
        <BannerCard
          key={banner.id}
          banner={banner}
          onDismiss={() => {
            dismiss(banner.id);
          }}
        />
      ))}
    </div>
  );
}
