/**
 * FrequencyGauge — the instrument an operator reads first, drawn as one.
 *
 * System frequency was a line of text among eleven other lines of text, which
 * is exactly wrong for the one quantity that decides whether the grid survives
 * the next thirty seconds. An analogue arc makes DEVIATION legible at a
 * glance — you read the needle's distance from centre without reading a number
 * at all — and the coloured bands teach the operating limits by being there.
 *
 * The bands are the real ones the rest of the console already uses:
 * ±0.2 Hz nominal, ±0.5 Hz to the trip region. Same numbers as the crisis
 * ladder and the health panel's tones, so three instruments cannot disagree.
 *
 * The needle is a CSS transform transition rather than a per-frame animation:
 * frequency updates at 10 Hz, and a spring loop would burn a frame budget the
 * 3D city needs for something the eye reads as smooth either way.
 */
import { useGridStore } from '@state';
import type { ReactElement } from 'react';

/** Sweep limits, Hz. */
const MIN_HZ = 59;
const MAX_HZ = 61;
/** Arc geometry. A 240° sweep leaves the bottom open for the readout. */
const START_ANGLE = -210;
const SWEEP = 240;

/**
 * Compact on purpose. The rail is the scarcest space in the product — it has
 * been overflowed twice — so this instrument earns its ~62px by REPLACING the
 * Frequency and RoCoF rows rather than sitting above them.
 */
const CX = 46;
const CY = 44;
const R = 32;

/** Band edges in Hz → the frozen semantic palette. */
const BANDS: readonly { from: number; to: number; color: string }[] = [
  { from: 59.0, to: 59.5, color: '#B3261E' },
  { from: 59.5, to: 59.8, color: '#B4531F' },
  { from: 59.8, to: 60.2, color: '#217A56' },
  { from: 60.2, to: 60.5, color: '#B4531F' },
  { from: 60.5, to: 61.0, color: '#B3261E' },
];

/** Hz → degrees on the dial. */
function angleFor(hz: number): number {
  const clamped = Math.min(MAX_HZ, Math.max(MIN_HZ, hz));
  return START_ANGLE + ((clamped - MIN_HZ) / (MAX_HZ - MIN_HZ)) * SWEEP;
}

function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

/** SVG arc path between two Hz values. */
function bandPath(fromHz: number, toHz: number, radius: number): string {
  const a0 = angleFor(fromHz);
  const a1 = angleFor(toHz);
  const p0 = polar(a0, radius);
  const p1 = polar(a1, radius);
  const largeArc = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${String(p0.x)} ${String(p0.y)} A ${String(radius)} ${String(radius)} 0 ${String(largeArc)} 1 ${String(p1.x)} ${String(p1.y)}`;
}

export function FrequencyGauge(): ReactElement {
  const frequency = useGridStore((s) => s.frequency);
  const rocof = useGridStore((s) => s.rocof);

  const deviation = Math.abs(frequency - 60);
  const critical = deviation >= 0.5;
  const caution = !critical && deviation >= 0.2;
  const tone = critical ? '#B3261E' : caution ? '#B4531F' : '#217A56';

  const needle = polar(angleFor(frequency), R - 7);
  const pivot = polar(angleFor(frequency) + 180, 5);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg
        width="92"
        height="62"
        viewBox="0 0 92 62"
        role="img"
        aria-label={`System frequency ${frequency.toFixed(2)} hertz`}
        style={{ flexShrink: 0 }}
      >
        {BANDS.map((band) => (
          <path
            key={`${String(band.from)}-${String(band.to)}`}
            d={bandPath(band.from, band.to, R)}
            fill="none"
            stroke={band.color}
            strokeWidth="7"
            // Slightly translucent so the needle reads as the foreground
            // instrument and the bands as the scale behind it.
            opacity={0.32}
          />
        ))}

        {/* Nominal tick at 60.00 — the thing the needle is trying to sit on. */}
        <line
          x1={polar(angleFor(60), R - 10).x}
          y1={polar(angleFor(60), R - 10).y}
          x2={polar(angleFor(60), R + 5).x}
          y2={polar(angleFor(60), R + 5).y}
          stroke="#5A6774"
          strokeWidth="1.5"
        />

        {/* The needle. `critical` adds the shake so a trip-region excursion is
            felt as well as read — traceable to a measured deviation. */}
        <g className={critical ? 'gauge-needle-alarm' : undefined}>
          <line
            x1={pivot.x}
            y1={pivot.y}
            x2={needle.x}
            y2={needle.y}
            stroke={tone}
            strokeWidth="2.4"
            strokeLinecap="round"
            style={{ transition: 'x2 220ms ease-out, y2 220ms ease-out, stroke 300ms ease' }}
          />
          <circle cx={CX} cy={CY} r="4" fill={tone} />
          <circle cx={CX} cy={CY} r="1.7" fill="#FAFAF7" />
        </g>

        {/* Scale ends, so the bands mean something without a legend. */}
        <text
          x={2}
          y={58}
          fontSize="7"
          fill="#8B97A3"
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
        >
          59
        </text>
        <text
          x={78}
          y={58}
          fontSize="7"
          fill="#8B97A3"
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
        >
          61
        </text>
      </svg>

      <div style={{ minWidth: 0 }}>
        <div
          className="console-value"
          style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1, color: tone }}
        >
          {frequency.toFixed(2)}
          <span style={{ fontSize: 11, color: '#8B97A3', marginLeft: 3 }}>Hz</span>
        </div>
        <div className="console-value" style={{ fontSize: 10.5, color: '#5A6774', marginTop: 2 }}>
          {rocof >= 0 ? '+' : '−'}
          {Math.abs(rocof).toFixed(2)} Hz/s
        </div>
        <div style={{ fontSize: 9.5, color: tone, marginTop: 2, fontWeight: 600 }}>
          {critical ? 'OUTSIDE TRIP LIMITS' : caution ? 'OFF NOMINAL' : 'NOMINAL'}
        </div>
      </div>
    </div>
  );
}
