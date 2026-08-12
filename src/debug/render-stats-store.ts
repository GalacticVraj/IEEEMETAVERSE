/**
 * Measured renderer statistics. Written ONLY by `RenderStatsProbe` (which
 * lives inside the Canvas and is the only place with access to `gl.info`),
 * read by the debug overlay. This is developer instrumentation, not
 * simulation state — it observes the renderer, never the engine.
 */
import { create } from 'zustand';

export interface RenderStats {
  readonly fps: number;
  readonly drawCalls: number;
  readonly triangles: number;
  /** JS heap in MB where the browser exposes it, else null. */
  readonly heapMb: number | null;
}

export const useRenderStatsStore = create<RenderStats>()(() => ({
  fps: 0,
  drawCalls: 0,
  triangles: 0,
  heapMb: null,
}));
