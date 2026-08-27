/**
 * share-card.ts — the run, as one image.
 *
 * Pure canvas drawing, kept out of the React component so the layout can be
 * reasoned about (and unit-tested for its text) without mounting anything.
 *
 * Every figure on the card comes from the finished run. There is no branding
 * for a team that does not exist and no claim the run did not earn — a result
 * card is the artefact most likely to be screenshotted and shared, which makes
 * it the worst possible place to put a number nobody measured.
 */

export interface ShareCardData {
  readonly operatorName: string;
  readonly rank: string;
  readonly scenarioName: string;
  /** 0–100 overall from `scoreRun`. */
  readonly score: number;
  readonly outcome: string;
  readonly districtsHeld: number;
  readonly districtsTotal: number;
  readonly worstFrequencyDeviationHz: number;
  readonly peakCorridorStress: number;
  readonly unservedMwS: number;
}

export const SHARE_CARD_WIDTH = 600;
export const SHARE_CARD_HEIGHT = 400;

/** The daylight console palette, so the card looks like the product. */
const INK = '#1C2530';
const INK_MUTED = '#5A6774';
const PAPER = '#FAFAF7';
const RULE = '#D3D7D2';
const ACCENT = '#22637E';

function toneFor(score: number): string {
  if (score >= 75) return '#217A56';
  if (score >= 50) return '#9A6B15';
  return '#B3261E';
}

/** The line a player pastes somewhere. No invented affiliation. */
export function shareText(data: ShareCardData): string {
  return (
    `I scored ${String(data.score)}/100 on ${data.scenarioName} as ${data.rank} — ` +
    `held ${String(data.districtsHeld)}/${String(data.districtsTotal)} districts. ` +
    `GridGuard · IEEE Metaverse Grand Challenge 2026 #IEEEMetaverse`
  );
}

/** Draw the card into a 600×400 canvas. Returns the canvas for chaining. */
export function renderShareCard(canvas: HTMLCanvasElement, data: ShareCardData): HTMLCanvasElement {
  canvas.width = SHARE_CARD_WIDTH;
  canvas.height = SHARE_CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return canvas;

  const mono = "'JetBrains Mono', ui-monospace, Consolas, monospace";
  const sans = "'Inter', system-ui, -apple-system, sans-serif";

  // Paper
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);

  // Header band
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, SHARE_CARD_WIDTH, 6);

  ctx.fillStyle = INK;
  ctx.font = `700 20px ${mono}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('GRIDGUARD', 32, 52);

  ctx.fillStyle = INK_MUTED;
  ctx.font = `500 11px ${mono}`;
  ctx.fillText('MERIDIAN BAY GRID OPERATIONS', 32, 70);

  ctx.textAlign = 'right';
  ctx.fillStyle = INK_MUTED;
  ctx.font = `500 10px ${mono}`;
  ctx.fillText('IEEE METAVERSE GRAND CHALLENGE 2026', SHARE_CARD_WIDTH - 32, 52);
  ctx.textAlign = 'left';

  // Rule
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 88);
  ctx.lineTo(SHARE_CARD_WIDTH - 32, 88);
  ctx.stroke();

  // Scenario
  ctx.fillStyle = INK_MUTED;
  ctx.font = `700 10px ${mono}`;
  ctx.fillText('SCENARIO', 32, 116);
  ctx.fillStyle = INK;
  ctx.font = `600 22px ${sans}`;
  ctx.fillText(data.scenarioName, 32, 144);

  ctx.fillStyle = INK_MUTED;
  ctx.font = `500 12px ${sans}`;
  ctx.fillText(`Outcome: ${data.outcome}`, 32, 166);

  // The number, big
  const tone = toneFor(data.score);
  ctx.textAlign = 'right';
  ctx.fillStyle = tone;
  ctx.font = `700 82px ${mono}`;
  ctx.fillText(String(data.score), SHARE_CARD_WIDTH - 32, 160);
  ctx.fillStyle = INK_MUTED;
  ctx.font = `500 13px ${mono}`;
  ctx.fillText('/ 100  MISSION RATING', SHARE_CARD_WIDTH - 32, 182);
  ctx.textAlign = 'left';

  // Metric strip — four measured figures, no icons that would need assets.
  const metrics: readonly { label: string; value: string }[] = [
    {
      label: 'DISTRICTS HELD',
      value: `${String(data.districtsHeld)}/${String(data.districtsTotal)}`,
    },
    { label: 'WORST Δf', value: `${data.worstFrequencyDeviationHz.toFixed(2)} Hz` },
    { label: 'PEAK CORRIDOR', value: `${String(Math.round(data.peakCorridorStress * 100))} %` },
    { label: 'UNSERVED', value: `${String(data.unservedMwS)} MW·s` },
  ];

  const stripY = 216;
  const stripH = 76;
  ctx.fillStyle = 'rgba(28, 37, 48, 0.04)';
  ctx.fillRect(32, stripY, SHARE_CARD_WIDTH - 64, stripH);
  ctx.strokeStyle = RULE;
  ctx.strokeRect(32, stripY, SHARE_CARD_WIDTH - 64, stripH);

  const cellW = (SHARE_CARD_WIDTH - 64) / metrics.length;
  metrics.forEach((metric, index) => {
    const cx = 32 + cellW * index + cellW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = INK_MUTED;
    ctx.font = `700 9px ${mono}`;
    ctx.fillText(metric.label, cx, stripY + 26);
    ctx.fillStyle = INK;
    ctx.font = `700 20px ${mono}`;
    ctx.fillText(metric.value, cx, stripY + 56);

    if (index > 0) {
      ctx.strokeStyle = RULE;
      ctx.beginPath();
      ctx.moveTo(32 + cellW * index, stripY + 12);
      ctx.lineTo(32 + cellW * index, stripY + stripH - 12);
      ctx.stroke();
    }
  });
  ctx.textAlign = 'left';

  // Operator
  ctx.fillStyle = INK_MUTED;
  ctx.font = `700 10px ${mono}`;
  ctx.fillText('OPERATOR', 32, 326);
  ctx.fillStyle = INK;
  ctx.font = `600 18px ${sans}`;
  ctx.fillText(data.operatorName, 32, 350);
  ctx.fillStyle = ACCENT;
  ctx.font = `700 12px ${mono}`;
  ctx.fillText(data.rank.toUpperCase(), 32, 370);

  // Footer claim — the thing that makes the number mean something.
  ctx.textAlign = 'right';
  ctx.fillStyle = INK_MUTED;
  ctx.font = `500 10px ${sans}`;
  ctx.fillText('Live physics. Every figure measured, none scripted.', SHARE_CARD_WIDTH - 32, 370);
  ctx.textAlign = 'left';

  return canvas;
}
