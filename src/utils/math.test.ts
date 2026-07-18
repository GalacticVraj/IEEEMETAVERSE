import { describe, expect, it } from 'vitest';

import { approxEqual, clamp, inverseLerp, lerp, remap } from './math';

describe('math utils', () => {
  it('clamp bounds a value', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('lerp interpolates', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it('inverseLerp is the inverse of lerp', () => {
    expect(inverseLerp(0, 10, 5)).toBe(0.5);
    expect(inverseLerp(4, 4, 4)).toBe(0);
  });

  it('remap moves between ranges', () => {
    expect(remap(5, 0, 10, 0, 100)).toBe(50);
  });

  it('approxEqual tolerates tiny differences', () => {
    expect(approxEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(approxEqual(1, 2)).toBe(false);
  });
});
