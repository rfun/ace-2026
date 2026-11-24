import { describe, expect, it } from 'vitest';
import { penFor } from './pens';

describe('penFor', () => {
  it('returns the same pen for the same id (catches a random or time-based pick that changes a person ink between visits)', () => {
    for (const id of ['u-sam', 'u-lee', 'abc', '']) expect(penFor(id)).toBe(penFor(id));
  });

  it('spreads 100 ids over all four pens (catches a hash that collapses onto fewer inks)', () => {
    const seen = new Set(Array.from({ length: 100 }, (_, i) => penFor(`user-${i}`)));
    expect([...seen].sort()).toEqual(['graphite', 'green', 'navy', 'violet']);
  });

  it('only ever returns a known pen (catches an out-of-range index yielding undefined)', () => {
    for (let i = 0; i < 200; i += 1) expect(['navy', 'green', 'violet', 'graphite']).toContain(penFor(`id${i}`));
  });
});
