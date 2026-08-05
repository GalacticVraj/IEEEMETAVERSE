/**
 * PersonaDialog — Davis on the intercom, centre-bottom.
 *
 * Presentational only: it types what it is given and reports the two things a
 * player can do (continue, skip). It knows nothing about beats, gates or
 * panels — TutorialManager owns all of that.
 *
 * DESIGN: this is the one dark surface in a daylight control room, so it reads
 * as "the intercom lit up" rather than a game speech bubble. The instruments
 * around it are untouched. Body copy is set at 14.5px against the console's
 * 11.5px — that size jump is what makes the onboarding feel unhurried while
 * the console stays dense.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { DavisPortrait } from './DavisPortrait';
import type { DavisMood } from './DavisPortrait';

const PANEL = '#232B33';
const INK = '#F2EDE3';
const DIM = '#9AA6B0';
const HIVIS = '#E0A100';
const RULE = '#3A444E';

/** Milliseconds per character. Fast enough to never feel like waiting. */
const TYPE_MS = 18;
/** Beat between one sentence finishing and the next starting. */
const LINE_PAUSE_MS = 320;

export interface PersonaDialogProps {
  readonly lines: readonly string[];
  readonly mood: DavisMood;
  /** Changes reset the typewriter — pass the beat id. */
  readonly beatKey: string;
  readonly stepIndex: number;
  readonly totalSteps: number;
  /** When set, the player must act in the city; no continue button is shown. */
  readonly waitingFor?: string | undefined;
  readonly cta?: string | undefined;
  readonly onAdvance: () => void;
  readonly onSkip: () => void;
}

export function PersonaDialog({
  lines,
  mood,
  beatKey,
  stepIndex,
  totalSteps,
  waitingFor,
  cta,
  onAdvance,
  onSkip,
}: PersonaDialogProps): ReactElement {
  const [lineIndex, setLineIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };

  // Reset whenever Davis moves to a new beat.
  useEffect(() => {
    stop();
    setLineIndex(0);
    setTyped('');
    setDone(false);
    return stop;
  }, [beatKey]);

  // Type the current line, then queue the next.
  //
  // How many characters are showing is derived from ELAPSED WALL-CLOCK TIME,
  // never from how many times this callback has run. A 3D scene on a weak GPU
  // can stretch a frame past half a second, and a naive one-char-per-timeout
  // typewriter then types at one character per frame — Davis would still be on
  // his first sentence a minute in. Deriving from elapsed time means a late
  // callback simply catches up several characters at once, so a beat takes the
  // same wall-clock time at 5 fps as at 60.
  useEffect(() => {
    const line = lines[lineIndex];
    if (line === undefined) return;

    const startedAt = performance.now();
    const tick = (): void => {
      const shown = Math.ceil((performance.now() - startedAt) / TYPE_MS);

      if (shown < line.length) {
        setTyped(line.slice(0, shown));
        timer.current = setTimeout(tick, TYPE_MS);
        return;
      }

      setTyped(line);
      if (lineIndex < lines.length - 1) {
        timer.current = setTimeout(() => {
          setLineIndex((i) => i + 1);
          setTyped('');
        }, LINE_PAUSE_MS);
      } else {
        setDone(true);
      }
    };
    timer.current = setTimeout(tick, TYPE_MS);

    return stop;
  }, [beatKey, lineIndex, lines]);

  /** Clicking mid-type shows the rest immediately — never make anyone wait. */
  const revealAll = (): void => {
    stop();
    setLineIndex(lines.length - 1);
    setTyped(lines[lines.length - 1] ?? '');
    setDone(true);
  };

  const settled = lines.slice(0, lineIndex);
  const canContinue = done && waitingFor === undefined;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 200,
        transform: 'translateX(-50%)',
        width: 'min(660px, 62vw)',
        zIndex: 40,
        pointerEvents: 'auto',
      }}
      className="animate-fade-in-up"
    >
      <div
        style={{
          background: PANEL,
          border: `1px solid ${RULE}`,
          borderRadius: 3,
          boxShadow: '0 10px 30px rgba(18, 24, 30, 0.34)',
          overflow: 'hidden',
        }}
      >
        {/* Lit annunciator bar — the strip that says the intercom is live */}
        <div style={{ height: 3, background: HIVIS }} />

        <div style={{ display: 'flex', gap: 14, padding: '13px 15px' }}>
          <DavisPortrait mood={mood} size={72} />

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Name plate + channel designation — he really is on channel one */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 6 }}>
              <span
                className="console-value"
                style={{ fontSize: 11, fontWeight: 600, color: INK, letterSpacing: '0.09em' }}
              >
                CHIEF ENG. DAVIS
              </span>
              <span
                className="console-value"
                style={{
                  fontSize: 9,
                  color: HIVIS,
                  border: `1px solid ${HIVIS}`,
                  borderRadius: 2,
                  padding: '0 4px',
                  letterSpacing: '0.1em',
                }}
              >
                CH.01
              </span>
              <span
                className="console-value"
                style={{ fontSize: 9.5, color: DIM, letterSpacing: '0.08em' }}
              >
                SHIFT HANDOVER
              </span>
            </div>

            <div
              onClick={done ? undefined : revealAll}
              style={{
                fontSize: 14.5,
                lineHeight: 1.55,
                color: INK,
                minHeight: 88,
                cursor: done ? 'default' : 'pointer',
              }}
            >
              {settled.map((line) => (
                <p key={line} style={{ margin: '0 0 6px' }}>
                  {line}
                </p>
              ))}
              <p style={{ margin: 0 }}>
                {typed}
                {!done && <span style={{ color: HIVIS }}>▌</span>}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginTop: 12,
                borderTop: `1px solid ${RULE}`,
                paddingTop: 9,
              }}
            >
              {/* Progress reads as a real sequence: this IS a handover checklist */}
              <div
                style={{ display: 'flex', gap: 4 }}
                aria-label={`Step ${stepIndex + 1} of ${totalSteps}`}
              >
                {Array.from({ length: totalSteps }, (_, i) => (
                  <span
                    key={i}
                    style={{
                      width: i === stepIndex ? 16 : 7,
                      height: 3,
                      borderRadius: 1,
                      background: i <= stepIndex ? HIVIS : RULE,
                    }}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={onSkip}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: DIM,
                    fontSize: 11.5,
                    cursor: 'pointer',
                    padding: '3px 4px',
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  Skip tutorial
                </button>

                {waitingFor !== undefined ? (
                  <span
                    className="console-value"
                    style={{ fontSize: 11, color: HIVIS, letterSpacing: '0.06em' }}
                  >
                    ▸ {waitingFor}
                  </span>
                ) : (
                  <button
                    onClick={canContinue ? onAdvance : revealAll}
                    style={{
                      background: HIVIS,
                      border: 'none',
                      borderRadius: 2,
                      color: '#1B222A',
                      fontSize: 12.5,
                      fontWeight: 600,
                      padding: '6px 16px',
                      cursor: 'pointer',
                    }}
                  >
                    {canContinue ? (cta ?? 'Continue') : 'Skip ahead'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
