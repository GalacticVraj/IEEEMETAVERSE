/**
 * ground-texture.ts — the city's ground, drawn once into a canvas.
 *
 * Replaces two things that made the scene read as a debug blockout:
 *
 * 1. `gridHelper`, which draws with `LineBasicMaterial`. That material is
 *    UNLIT, so the survey grid ignored the time-of-day rig entirely: as the
 *    city fell into night the grid stayed at full daylight brightness, which
 *    is precisely the "flat neon wireframe" look. Baked into a texture on a
 *    MeshStandardMaterial, the same grid is lit like everything else and dims
 *    on the same curve as the buildings standing on it.
 *
 * 2. The hard-edged city terrain slab. The city plane and the far terrain were
 *    different colours at different heights, so all four edges of the built
 *    area were visible from the hero camera — the city looked like a card lying
 *    on a table. The texture now fades to fully transparent at its border, so
 *    the built ground dissolves into the surrounding terrain instead of ending.
 *
 * Pure drawing code: no simulation state, no per-frame work. Built once and
 * cached.
 */
import * as THREE from 'three';

/**
 * World size covered by the texture. Matches the existing city terrain plane
 * exactly (220 x 260 centred at x = -20), whose eastern edge already lands on
 * the shoreline at x = +90.
 */
export const GROUND_TEXTURE_WORLD = { width: 220, depth: 260 } as const;

/** Texture resolution. 1024 keeps 10-unit grid squares ~34px — crisp, cheap. */
const RESOLUTION = 1024;

/** Survey grid spacing in world units — the same 10 the old helper used. */
const GRID_SPACING_WORLD = 10;

/** Base ground tone. Matches the far terrain so the seam cannot show. */
const BASE = '#2C4438';
/** The built area sits a touch lighter than open country. */
const BUILT = '#35513F';
/** Grid ink — a lighter tint of the ground, never a saturated line colour. */
const GRID_INK = 'rgba(150, 196, 164, 0.20)';
const GRID_INK_MAJOR = 'rgba(150, 196, 164, 0.34)';

/** Every 5th line is a major division, as on a real survey sheet. */
const MAJOR_EVERY = 5;

/** Share of each faded edge given over to the falloff. */
const EDGE_FADE_FRACTION = 0.13;

let cached: THREE.CanvasTexture | null = null;

/**
 * The ground texture, built on first use and reused thereafter.
 *
 * Returns null when there is no 2D canvas context — jsdom under test, or a
 * browser refusing the context. Callers fall back to a plain colour, so the
 * scene degrades to what it looked like before rather than throwing.
 */
export function groundTexture(): THREE.CanvasTexture | null {
  if (cached !== null) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = RESOLUTION;
  canvas.height = RESOLUTION;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return null;

  const pxPerWorldX = RESOLUTION / GROUND_TEXTURE_WORLD.width;
  const pxPerWorldZ = RESOLUTION / GROUND_TEXTURE_WORLD.depth;

  // --- base ground -------------------------------------------------------
  ctx.fillStyle = BASE;
  ctx.fillRect(0, 0, RESOLUTION, RESOLUTION);

  // --- the built area, very slightly lifted out of the countryside -------
  // A soft ellipse rather than a rectangle: a rectangle would just reinstate
  // the hard slab edge this texture exists to remove.
  const built = ctx.createRadialGradient(
    RESOLUTION * 0.5,
    RESOLUTION * 0.5,
    RESOLUTION * 0.08,
    RESOLUTION * 0.5,
    RESOLUTION * 0.5,
    RESOLUTION * 0.66,
  );
  built.addColorStop(0, BUILT);
  built.addColorStop(0.72, BUILT);
  built.addColorStop(1, 'rgba(53, 81, 63, 0)');
  ctx.fillStyle = built;
  ctx.fillRect(0, 0, RESOLUTION, RESOLUTION);

  // --- survey grid -------------------------------------------------------
  ctx.lineWidth = 1;
  const stepX = GRID_SPACING_WORLD * pxPerWorldX;
  const stepZ = GRID_SPACING_WORLD * pxPerWorldZ;

  for (let i = 0, x = 0; x <= RESOLUTION; i++, x = i * stepX) {
    ctx.strokeStyle = i % MAJOR_EVERY === 0 ? GRID_INK_MAJOR : GRID_INK;
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, RESOLUTION);
    ctx.stroke();
  }
  for (let i = 0, y = 0; y <= RESOLUTION; i++, y = i * stepZ) {
    ctx.strokeStyle = i % MAJOR_EVERY === 0 ? GRID_INK_MAJOR : GRID_INK;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(RESOLUTION, Math.round(y) + 0.5);
    ctx.stroke();
  }

  // --- edge falloff ------------------------------------------------------
  // Punch the alpha out towards the border so the plane has no visible edge.
  // `destination-out` erases what is already drawn rather than painting over
  // it, which is what lets the far terrain show through underneath.
  //
  // Only three edges fade. The EAST edge is left hard on purpose: it sits at
  // the shoreline (x = +90), and the ocean plane already overlaps it, so a
  // fade there would just thin the land out from under the harbour. Fading it
  // like the others is the one change here that would look worse.
  const band = Math.round(RESOLUTION * EDGE_FADE_FRACTION);
  ctx.globalCompositeOperation = 'destination-out';

  const erase = (x0: number, y0: number, x1: number, y1: number, w: number, h: number): void => {
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), w, h);
  };

  // West (-X) is texture-left; north/south are texture top/bottom.
  erase(0, 0, band, 0, band, RESOLUTION);
  erase(0, 0, 0, band, RESOLUTION, band);
  erase(0, RESOLUTION, 0, RESOLUTION - band, RESOLUTION, band);

  ctx.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  cached = texture;
  return texture;
}

/** Test seam: drop the cache so a fresh texture is built. */
export function resetGroundTexture(): void {
  cached?.dispose();
  cached = null;
}
