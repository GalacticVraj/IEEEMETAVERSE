/**
 * Samples real renderer statistics from inside the Canvas and publishes them
 * for the debug overlay. Mount as a child of `<Canvas>`; renders nothing.
 *
 * The store is written at most 4×/second — writing every frame would make
 * React re-render the overlay 60×/second and distort the very FPS it reports.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';

import { useRenderStatsStore } from './render-stats-store';

const SAMPLE_INTERVAL_S = 0.25;
/** Smoothing factor for the frame-rate EMA — low enough to stay readable. */
const FPS_SMOOTHING = 0.1;
const BYTES_PER_MB = 1_048_576;

export function RenderStatsProbe(): null {
  const gl = useThree((state) => state.gl);
  const fps = useRef(60);
  const sinceSample = useRef(0);

  useFrame((_, delta) => {
    if (delta > 0) {
      const instant = 1 / delta;
      fps.current += (instant - fps.current) * FPS_SMOOTHING;
    }

    sinceSample.current += delta;
    if (sinceSample.current < SAMPLE_INTERVAL_S) return;
    sinceSample.current = 0;

    const memory = (performance as { memory?: { usedJSHeapSize: number } }).memory;
    useRenderStatsStore.setState({
      fps: Math.round(fps.current),
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      heapMb: memory === undefined ? null : Math.round(memory.usedJSHeapSize / BYTES_PER_MB),
    });
  });

  return null;
}
