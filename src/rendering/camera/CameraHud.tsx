/**
 * CameraHud — minimal camera controls overlay. Auto-follow toggle, Overview,
 * Skip intro, intro captions, and (dev only) the current shot name. Sits in
 * the free center strip; never overlaps the Mission Control rails.
 */
import { useEffect } from 'react';
import type { ReactElement } from 'react';

import { useCameraStore } from './camera-store';
import { OPERATOR_HOME } from './shots';

const skipIntro = (): void => {
  const store = useCameraStore.getState();
  store.cancelScripted(performance.now());
  store.markIntroDone();
  store.requestShot(OPERATOR_HOME, { priority: 100, timing: 'FAST' });
};

const goOverview = (): void => {
  useCameraStore.getState().requestShot(OPERATOR_HOME, { priority: 60, timing: 'NORMAL' });
};

export function CameraHud({ dev = false }: { dev?: boolean }): ReactElement {
  const autoFollow = useCameraStore((s) => s.autoFollow);
  const setAutoFollow = useCameraStore((s) => s.setAutoFollow);
  const introActive = useCameraStore((s) => s.introActive);
  const currentShotName = useCameraStore((s) => s.currentShotName);
  const scripted = useCameraStore((s) => s.request !== null);

  // ESC skips the intro / cancels any scripted move.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      const store = useCameraStore.getState();
      if (store.introActive) {
        skipIntro();
      } else if (store.request !== null) {
        store.cancelScripted(performance.now());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (introActive) {
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none' }}>
        {/* Lower-third caption */}
        <div
          style={{
            position: 'absolute',
            bottom: 64,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            className="console-panel console-value"
            style={{
              padding: '10px 24px',
              fontSize: 13,
              letterSpacing: '0.08em',
              fontWeight: 700,
              borderRadius: 8,
            }}
          >
            {currentShotName ?? 'MERIDIAN BAY'}
          </div>
        </div>
        {/* Skip */}
        <button
          className="console-btn-primary"
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            pointerEvents: 'auto',
            minHeight: 36,
            padding: '8px 18px',
          }}
          onClick={skipIntro}
        >
          Skip intro ▸
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 192,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 25,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        pointerEvents: 'auto',
      }}
    >
      <button
        className="console-btn"
        style={{ padding: '4px 14px', fontSize: 11, minHeight: 28, borderRadius: 6 }}
        onClick={() => setAutoFollow(!autoFollow)}
        title="When on, the camera gently follows major grid events unless you are steering"
      >
        Auto-follow: {autoFollow ? 'ON' : 'OFF'}
      </button>
      <button
        className="console-btn"
        style={{ padding: '4px 14px', fontSize: 11, minHeight: 28, borderRadius: 6 }}
        onClick={goOverview}
      >
        Overview Camera
      </button>
      {dev && scripted && currentShotName !== null && (
        <span
          className="console-value"
          style={{
            fontSize: 10,
            color: '#5A6774',
            background: 'rgba(250, 250, 247, 0.8)',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {currentShotName}
        </span>
      )}
    </div>
  );
}
