/**
 * voice-rate.ts — per-asset playback pitch.
 *
 * Firing one identical sample every time a unit trips turns a cascade into a
 * stutter: the ear stops hearing events and starts hearing a loop. The brief
 * asked for "slight pitch variation per trip", and the obvious implementation
 * is a random detune — but this project is deterministic end to end (seeded
 * RNG, replayable runs), and a random pitch would make the same replay sound
 * different on every playback.
 *
 * So the pitch is derived from the ASSET ID instead. That is deterministic,
 * replay-safe, and strictly more informative than randomness: the Southbay
 * baseload plant has its own voice, the harbor gas unit has another, and after
 * two runs a player can hear WHICH machine they just lost before reading it.
 */

/** FNV-1a over the id — small, stable, and dependency-free. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Widest detune, as a fraction of nominal rate. ±8 % ≈ ±1.4 semitones. */
const SPREAD = 0.08;

/**
 * A stable playback rate in `[1 - SPREAD, 1 + SPREAD]` for the given asset id.
 * Returns exactly 1 for an empty id so an unattributed cue is never detuned.
 */
export function voiceRateFor(assetId: string): number {
  if (assetId.length === 0) return 1;
  // 0..1 from the hash, then mapped onto the symmetric spread.
  const unit = hash32(assetId) / 0xffffffff;
  return 1 + (unit * 2 - 1) * SPREAD;
}
