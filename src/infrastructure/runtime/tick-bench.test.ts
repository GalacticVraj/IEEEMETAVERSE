import { PROFILES } from '@config';
import { describe, it } from 'vitest';

import { bootstrap } from '../bootstrap/bootstrap';
import { SIMULATION_KERNEL } from '../di/composition-root';

describe('tick benchmark', () => {
  it('measures per-tick cost', () => {
    const runtime = bootstrap(PROFILES.development);
    const kernel = runtime.container.resolve(SIMULATION_KERNEL);
    kernel.start();
    kernel.tick(); // warm
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) kernel.tick();
    const t1 = performance.now();
    // eslint-disable-next-line no-console
    console.log(`100 ticks in ${(t1 - t0).toFixed(1)} ms → ${((t1 - t0) / 100).toFixed(2)} ms/tick`);
    runtime.shutdown();
  });
});
