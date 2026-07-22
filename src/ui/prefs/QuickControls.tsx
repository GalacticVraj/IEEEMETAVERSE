/**
 * QuickControls — accessibility & preference chips (sound, shortcuts).
 * Sits bottom-right above the timeline, mirroring the camera chips at
 * bottom-center. Also owns the global keyboard shortcuts:
 *   Space — pause/resume the run · O — overview camera · M — sound toggle
 */
import { useEffect } from 'react';
import type { ReactElement } from 'react';

import { AppMode, useAppFlowStore, useUiStore } from '@state';

import { useCameraStore } from '../../rendering/camera/camera-store';
import { OPERATOR_HOME } from '../../rendering/camera/shots';
import { useRuntime } from '../../runtime-context';

export function QuickControls(): ReactElement {
  const soundMuted = useUiStore((s) => s.soundMuted);
  const toggleSound = useUiStore((s) => s.toggleSound);
  const runtime = useRuntime();

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
        bottom: 190,
        right: 12,
        zIndex: 25,
        display: 'flex',
        gap: 6,
        pointerEvents: 'auto',
      }}
    >
      <button
        className="console-btn"
        style={{ padding: '3px 10px', fontSize: 11 }}
        onClick={toggleSound}
        title="Toggle the ambient + cue audio layer (shortcut: M)"
      >
        Sound: {soundMuted ? 'OFF' : 'ON'}
      </button>
      <span
        className="console-value"
        style={{ fontSize: 10, color: '#8B97A3', alignSelf: 'center' }}
        title="Keyboard shortcuts"
      >
        SPACE pause · O overview · M sound · ESC skip
      </span>
    </div>
  );
}
