/**
 * DavisPortrait — Chief Engineer Davis, drawn in code.
 *
 * Register: SAFETY SIGNAGE, not caricature. This is a refined version of the
 * pictogram on a "hard hat area" sign — geometric, flat, three tones, features
 * reduced to the few strokes that carry an expression. That vernacular comes
 * from the subject's own world, which keeps it clear of both cartoon mascot
 * and uncanny portrait, and it survives being 40px tall on the AdvisorCard.
 *
 * No raster assets, no network fetch, ~3 kB inline. The mood only ever changes
 * two strokes — brow angle and mouth — so he stays recognisably one person.
 */
import type { ReactElement } from 'react';

export type DavisMood = 'neutral' | 'focused' | 'grave' | 'approving';

const HIVIS = '#E0A100';
const HIVIS_SHADE = '#B37F00';
const FACE = '#8D96A0';
const FACE_SHADE = '#79828C';
const INK = '#2A333C';
const REFLECTIVE = '#F2EDE3';

/** Brow and mouth are the whole performance. */
const EXPRESSION: Record<DavisMood, { browY: number; browTilt: number; mouth: string }> = {
  neutral: { browY: 0, browTilt: 0, mouth: 'M26 45 L38 45' },
  focused: { browY: 1.5, browTilt: 1.6, mouth: 'M26 45 L38 45' },
  grave: { browY: 2.5, browTilt: 2.8, mouth: 'M26 46 Q32 43.5 38 46' },
  approving: { browY: -1, browTilt: -0.8, mouth: 'M26 44.5 Q32 48 38 44.5' },
};

export interface DavisPortraitProps {
  readonly mood?: DavisMood;
  readonly size?: number;
  /** Tints the frame — lets the portrait carry live grid status. */
  readonly statusColor?: string;
}

export function DavisPortrait({
  mood = 'neutral',
  size = 64,
  statusColor,
}: DavisPortraitProps): ReactElement {
  const { browY, browTilt, mouth } = EXPRESSION[mood];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`Chief Engineer Davis, ${mood}`}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Plate */}
      <rect x="0" y="0" width="64" height="64" rx="2" fill="#1B222A" />

      {/* Hi-vis shoulders — the reflective band reads instantly as utility PPE */}
      <path d="M8 64 Q8 50 20 46 L44 46 Q56 50 56 64 Z" fill={HIVIS} />
      <path d="M8 64 Q8 50 20 46 L24 46 Q13 51 13 64 Z" fill={HIVIS_SHADE} />
      <rect x="15" y="55" width="34" height="2.6" fill={REFLECTIVE} opacity="0.85" />

      {/* Neck */}
      <rect x="28" y="40" width="8" height="8" fill={FACE_SHADE} />

      {/* Head */}
      <path d="M20 28 Q20 18 32 18 Q44 18 44 28 L44 36 Q44 46 32 46 Q20 46 20 36 Z" fill={FACE} />
      {/* Jaw shading keeps it from reading flat */}
      <path d="M20 34 Q20 46 32 46 Q26 44 24 34 Z" fill={FACE_SHADE} />

      {/* Hard hat — dome, crown rib, brim */}
      <path d="M17 27 Q17 11 32 11 Q47 11 47 27 Z" fill={HIVIS} />
      <path d="M17 27 Q17 11 32 11 Q24 15 23 27 Z" fill={HIVIS_SHADE} />
      <rect x="30.6" y="12" width="2.8" height="15" fill={HIVIS_SHADE} opacity="0.7" />
      <rect x="13" y="26.4" width="38" height="3.6" rx="1.2" fill={HIVIS} />
      <rect x="13" y="28.6" width="38" height="1.4" rx="0.7" fill={HIVIS_SHADE} />

      {/* Brow + eyes — safety glasses implied by the bar, not drawn literally */}
      <g transform={`translate(0 ${browY})`}>
        <path
          d={`M23.5 ${35 - browTilt} L29 ${35 + browTilt}`}
          stroke={INK}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d={`M35 ${35 + browTilt} L40.5 ${35 - browTilt}`}
          stroke={INK}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="26.2" cy="38.6" r="1.5" fill={INK} />
        <circle cx="37.8" cy="38.6" r="1.5" fill={INK} />
      </g>

      {/* Mouth */}
      <path d={mouth} stroke={INK} strokeWidth="1.7" strokeLinecap="round" fill="none" />

      {/* Status frame — tints with live grid condition when supplied */}
      {statusColor !== undefined && (
        <rect
          x="0.9"
          y="0.9"
          width="62.2"
          height="62.2"
          rx="2"
          fill="none"
          stroke={statusColor}
          strokeWidth="1.8"
        />
      )}
    </svg>
  );
}
