/**
 * CommandBar — top operations header: identity, scenario, sim clock, grid
 * stability chip, playback control. All values from projections.
 *
 * The bar's own colour is now part of the instrument. It reads the ONE crisis
 * ladder (`ui/crisis/crisis-level`) that the alert stack and the alarm lamp
 * also read, so the header, the banners and the vignette can never disagree
 * about how much trouble the grid is in — they are three renderings of a
 * single measured assessment. The bar's previous private `stabilityOf` was
 * that same judgement made a second time, and it has been deleted rather than
 * left to drift.
 *
 * Colour stays daylight through WARNING and CRITICAL: the paper tints, it does
 * not invert. The one level that goes genuinely dark is BLACKOUT, because by
 * then the districts this bar reports on are dark too.
 */
import {
  AppMode,
  CRISIS_CARDS,
  useAppFlowStore,
  useGridStore,
  nextRank,
  rankOf,
  useCareerStore,
  useRunStatsStore,
  useSimulationStore,
} from '@state';
import { useState } from 'react';
import type { ReactElement } from 'react';

import { useRuntime } from '../../runtime-context';
import { Tooltip } from '../common/Tooltip';
import { CRISIS_LEVEL_STYLE, useCrisisAssessment } from '../crisis';
import type { CrisisLevelStyle } from '../crisis';

import { HomesPowered } from './HomesPowered';
import { dayPhase, simClock } from './learning-copy';

function ShieldIcon(): ReactElement {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

/**
 * The running consequence counter: how many of Meridian Bay's districts you
 * have kept lit for the whole shift. `zonesEverDark` is a run-stats
 * accumulation of REAL ZoneBlackout observations - a district that went dark
 * and was restored still counts as lost, because it was. This is the number
 * the after-action Resilience score is built from, surfaced live so the player
 * can see the stake before the debrief tells them about it.
 */
function DistrictScore({ style }: { style: CrisisLevelStyle }): ReactElement | null {
  const zones = useGridStore((s) => s.zones);
  const everDark = useRunStatsStore((s) => s.zonesEverDark);

  const total = zones.length;
  if (total === 0) return null;
  const lost = everDark.length;
  const held = Math.max(0, total - lost);
  const color = lost === 0 ? style.accent : lost >= total / 2 ? '#F1544B' : '#B4531F';

  return (
    <Tooltip
      title="Districts held"
      content="Districts that have never lost power this shift. A district that blacked out counts as lost even after you restore it - the outage already happened."
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
        }}
      >
        <span>
          {held}/{total}
        </span>
        <span style={{ fontSize: 9.5, color: style.barInkMuted, letterSpacing: '0.06em' }}>
          HELD
        </span>
      </span>
    </Tooltip>
  );
}

/**
 * Who is on shift, and what they have earned.
 *
 * Rank is derived from the career total rather than stored, so it can never
 * disagree with the score behind it. Clicking the name lets the operator set
 * it — a competition demo wants the judge's own name on the console, and
 * asking for it in a modal before anyone has played would be worse.
 */
function OperatorIdentity({ style }: { style: CrisisLevelStyle }): ReactElement {
  const name = useCareerStore((s) => s.operatorName);
  const totalScore = useCareerStore((s) => s.totalScore);
  const totalRuns = useCareerStore((s) => s.totalRuns);
  const setOperatorName = useCareerStore((s) => s.setOperatorName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const rank = rankOf(totalScore);
  const next = nextRank(totalScore);

  const commit = (): void => {
    setOperatorName(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        className="console-value"
        autoFocus
        value={draft}
        maxLength={24}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(name);
            setEditing(false);
          }
        }}
        aria-label="Operator name"
        style={{
          fontSize: 11,
          fontWeight: 700,
          width: 130,
          padding: '4px 8px',
          borderRadius: 6,
          border: `1px solid ${style.accent}`,
          background: style.barWell,
          color: style.barInk,
        }}
      />
    );
  }

  return (
    <Tooltip
      title={`${rank} · ${String(totalScore)} career points`}
      content={
        next === null
          ? `${String(totalRuns)} shift(s) on record. You have reached the top of the ladder.`
          : `${String(totalRuns)} shift(s) on record. ${String(next.remaining)} more points to make ${next.rank}. Click to change your name.`
      }
      position="bottom"
    >
      <button
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        className="console-value"
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 6,
          fontSize: 11,
          fontWeight: 700,
          color: style.barInk,
          background: style.barWell,
          border: `1px solid ${style.barWellBorder}`,
          borderRadius: 6,
          padding: '4px 10px',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <span>{name}</span>
        <span style={{ fontSize: 9.5, color: style.barInkMuted, letterSpacing: '0.05em' }}>
          {rank.toUpperCase()}
        </span>
      </button>
    </Tooltip>
  );
}

export function CommandBar(): ReactElement {
  const runtime = useRuntime();
  const mode = useAppFlowStore((s) => s.mode);
  const selectedCrisis = useAppFlowStore((s) => s.selectedCrisis);
  const resolveCrisis = useAppFlowStore((s) => s.resolveCrisis);
  const tick = useGridStore((s) => s.tick);
  const zones = useGridStore((s) => s.zones);
  const lifecycle = useSimulationStore((s) => s.lifecycle);

  const { level, reason } = useCrisisAssessment();
  const style = CRISIS_LEVEL_STYLE[level];

  const darkZones = zones.filter((z) => z.state === 'Blackout').length;
  const active = mode === AppMode.ActiveCrisis;
  const paused = lifecycle === 'Paused';
  const scenarioName = CRISIS_CARDS.find((c) => c.id === selectedCrisis)?.label ?? null;

  const endShift = (): void => {
    runtime.session.stop();
    resolveCrisis(darkZones > 0 ? 'blackout' : 'success');
  };

  return (
    <div
      className="console-panel"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        borderRadius: '0 0 8px 8px',
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        borderBottom: `1px solid ${style.barBorder}`,
        height: '48px',
        background: style.bar,
        // Slow enough to read as the room changing, fast enough that the
        // escalation and its banner land together.
        transition: 'background 420ms ease, border-color 420ms ease',
      }}
    >
      {/* Identity + scenario */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: '#22637E',
              color: '#FAFAF7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldIcon />
          </div>
          <span
            className="console-value"
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: style.barInk,
            }}
          >
            GRIDGUARD
          </span>
        </div>
        <span style={{ color: style.barDivider, fontWeight: 300 }}>|</span>
        {/* The standing objective. The hero screen states the role once and
            then you leave it behind; nothing in the console used to say what
            the job actually was. One line, always visible, never a modal. */}
        <span
          style={{
            fontSize: 11.5,
            color: style.barInkMuted,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {active ? (
            <>
              <span style={{ color: style.barInk, fontWeight: 600 }}>
                You are the grid operator
              </span>
              {' — keep every district powered to T+03:00'}
            </>
          ) : (
            'MERIDIAN BAY OPERATIONS'
          )}
        </span>
        {scenarioName !== null && (
          <>
            <span style={{ color: style.barDivider, fontWeight: 300 }}>|</span>
            <span
              style={{
                fontSize: 12,
                color: style.barLink,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                // Shrinks and ellipsises rather than pushing the clock into
                // the identity chip on a narrow window.
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {scenarioName}
            </span>
          </>
        )}
      </div>

      {/* Sim clock */}
      <Tooltip
        title="Simulation Time & Day Phase"
        content="Tracks real physics elapsed time and heatwave diurnal curve."
        position="bottom"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: style.barWell,
            padding: '4px 12px',
            borderRadius: 6,
            cursor: 'help',
          }}
        >
          <span
            className="console-value"
            style={{ fontSize: 14, fontWeight: 700, color: style.barInk }}
          >
            {simClock(tick)}
          </span>
          <span style={{ fontSize: 11, color: style.barInkMuted, fontWeight: 500 }}>
            {dayPhase(tick)}
          </span>
        </div>
      </Tooltip>

      {/* Status + controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {active && <HomesPowered style={style} />}
        <OperatorIdentity style={style} />
        {active && <DistrictScore style={style} />}
        <Tooltip
          title={`Grid state: ${style.label}`}
          // The static line teaches what the level MEANS; the live line says
          // which reading earned it right now. A player who reads both learns
          // the instrument, not just the colour. Passed as nodes because the
          // tooltip renders with `white-space: normal` and would eat "\n".
          content={
            <>
              <div>{style.meaning}</div>
              <div style={{ marginTop: 5, color: '#FAFAF7', fontWeight: 600 }}>
                Right now: {reason}
              </div>
            </>
          }
          position="bottom"
        >
          <span
            className="console-value"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color: style.accent,
              background: style.barWell,
              border: `1px solid ${style.accent}`,
              borderRadius: 6,
              padding: '4px 12px',
              letterSpacing: '0.06em',
              cursor: 'help',
              transition: 'color 420ms ease, border-color 420ms ease',
            }}
          >
            <span className="status-led" style={{ background: style.accent }} aria-hidden />
            {active || mode === AppMode.AfterAction ? style.label : 'STANDBY'}
          </span>
        </Tooltip>
        {active && (
          <>
            <Tooltip
              title={paused ? 'Resume Simulation Engine' : 'Pause Simulation Engine'}
              content={
                paused
                  ? 'Resumes real-time clock advancement and physics solver. Shortcut: SPACE'
                  : 'Freezes simulation clock and physics ticks. Allows inspecting network status without time pressure. Shortcut: SPACE'
              }
              position="bottom"
            >
              <button
                className="console-btn"
                onClick={() => (paused ? runtime.session.resume() : runtime.session.pause())}
              >
                {paused ? '▶ Resume' : '⏸ Pause'}
              </button>
            </Tooltip>
            <Tooltip
              title="End Shift Early"
              content="Concludes the active scenario run and opens the evidence-based After-Action review with measured score."
              position="bottom"
            >
              <button className="console-btn" onClick={endShift}>
                End Shift
              </button>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
