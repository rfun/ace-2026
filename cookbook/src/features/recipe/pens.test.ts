import { describe, expect, it } from 'vitest';
// The test runner blanks CSS imports, so read stylesheet text from disk (tests run from cookbook/).
// @ts-ignore node types are not installed for the browser build; this runs under vitest only.
import { readFileSync } from 'node:fs';
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

describe('shared pen classes', () => {
  const read = (p: string): string => readFileSync(p, 'utf8');
  // Catches: a pen colour class missing from the shared sheet, or mapped to the wrong token.
  it('components.css defines .pen-<name> for every pen with its own token', () => {
    const css = read('src/styles/components.css');
    for (const pen of ['navy', 'green', 'violet', 'graphite']) {
      expect(css).toContain(`.pen-${pen} { color: var(--pen-${pen}); }`);
    }
  });
  // Catches: the duplicated per-feature pen rules coming back.
  it('recipe.css and tips.css no longer define their own pen colour classes', () => {
    for (const f of ['src/features/recipe/recipe.css', 'src/features/tips/tips.css']) {
      expect(read(f)).not.toMatch(/\.(rc|tips)-pen-(navy|green|violet|graphite)/);
    }
  });
});
