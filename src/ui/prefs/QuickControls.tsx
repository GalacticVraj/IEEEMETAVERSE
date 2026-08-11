/**
 * QuickControls — accessibility & preference chips (sound, shortcuts, tour).
 * Sits bottom-right above the timeline, mirroring the camera chips at
 * bottom-center. Also owns the global keyboard shortcuts:
 *   Space — pause/resume the run · O — overview camera · M — sound toggle
 */
import { useEffect } from 'react';
import type { ReactElement } from 'react';

import { AppMode, useAppFlowStore, useTutorialStore, useUiStore } from '@state';

import { useCameraStore } from '../../rendering/camera/camera-store';
import { OPERATOR_HOME } from '../../rendering/camera/shots';
import { useRuntime } from '../../runtime-context';
import { Tooltip } from '../common/Tooltip';

export function QuickControls(): ReactElement {
  const soundMuted = useUiStore((s) => s.soundMuted);
  const toggleSound = useUiStore((s) => s.toggleSound);
  const startOnboarding = useUiStore((s) => s.startOnboarding);
  const mode = useAppFlowStore((s) => s.mode);
  const tutorialActive = useTutorialStore((s) => s.active);
  const restartTutorial = useTutorialStore((s) => s.restart);
  const runtime = useRuntime();

  // Offered only in pre-flight, and only once Davis has stepped aside —
  // a "replay" chip during the tutorial itself would just be noise.
  const canReplayTutorial = mode === AppMode.Tutorial && !tutorialActive;

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as Element | null;
      if (target !== null && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (event.code === 'Space') {
        if (useAppFlowStore.getState().mode !== AppMode.ActiveCrisis) return;
        event.preventDefault();
        const { session } = runtime;
        if (session.running) session.pause();
        else session.resume();
      } else if (event.key === 'o' || event.key === 'O') {
        useCameraStore.getState().requestShot(OPERATOR_HOME, { priority: 60, timing: 'NORMAL' });
      } else if (event.key === 'm' || event.key === 'M') {
        useUiStore.getState().toggleSound();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runtime]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 192,
        right: 16,
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'auto',
      }}
    >
      {canReplayTutorial && (
        <button
          className="console-btn"
          style={{ padding: '3px 10px', fontSize: 11 }}
          onClick={restartTutorial}
          title="Have Chief Engineer Davis walk you through the console again"
        >
          Replay tutorial
        </button>
      )}

      <Tooltip
        title="Interactive Guided Tour"
        content="Launches a step-by-step 30-second walkthrough highlighting key Mission Control panels and controls."
        position="top"
      >
        <button
          className="console-btn-primary"
          style={{ padding: '4px 12px', fontSize: 11, minHeight: 28, borderRadius: 6 }}
          onClick={startOnboarding}
        >
          <span>❓</span>
          <span>Guide</span>
        </button>
      </Tooltip>

      <Tooltip
        title="Audio Telemetry Cues"
        content="Toggles real-time ambient grid hum and crisis alarm audio cues. Shortcut: M"
        position="top"
      >
        <button
          className="console-btn"
          style={{ padding: '4px 12px', fontSize: 11, minHeight: 28, borderRadius: 6 }}
          onClick={toggleSound}
        >
          <span>{soundMuted ? '🔇' : '🔊'}</span>
          <span>Sound: {soundMuted ? 'OFF' : 'ON'}</span>
        </button>
      </Tooltip>

      <Tooltip
        title="Keyboard Hotkeys"
        content="Quick control hotkeys: Space (Pause/Resume run), O (Overview camera viewpoint), M (Mute/Unmute audio), ESC (Skip intro/Cancel)."
        position="top"
      >
        <span
          className="console-value"
          style={{
            fontSize: 10.5,
            color: '#5A6774',
            background: 'rgba(250, 250, 247, 0.85)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(211, 215, 210, 0.7)',
            padding: '4px 10px',
            borderRadius: 6,
            fontWeight: 500,
          }}
        >
          SPACE pause · O overview · M sound · ESC skip
        </span>
      </Tooltip>
    </div>
  );
}
