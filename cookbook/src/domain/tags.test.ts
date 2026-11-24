import { describe, expect, it } from 'vitest';
import { COURSES, DIETARY, stockClass } from './tags';

const emoji = /[\p{Emoji_Presentation}\uFE0F]/u;

describe.each([['DIETARY', DIETARY], ['COURSES', COURSES]])('%s', (_name, table) => {
  const entries = Object.entries(table);
  it('every value has a non-empty label and symbol (catches a missing tag display)', () => {
    for (const [, info] of entries) {
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.symbol.length).toBeGreaterThan(0);
    }
  });
  it('labels and symbols are unique (catches two tags rendering identically)', () => {
    expect(new Set(entries.map(([, i]) => i.label)).size).toBe(entries.length);
    expect(new Set(entries.map(([, i]) => i.symbol)).size).toBe(entries.length);
  });
  it('symbols are a single glyph and not emoji', () => {
    for (const [, info] of entries) {
      expect([...info.symbol].length).toBe(1);
      expect(info.symbol).not.toMatch(emoji);
    }
  });
});

it('maps each course to the stock the owner chose (catches a course printed on the wrong stock)', () => {
  const expected = {
    breakfast: 'canary', snack: 'canary',
    side: 'mint', condiment: 'mint',
    main: 'blush', dessert: 'blush', sweets: 'blush',
    drink: 'sky',
  };
  expect(Object.fromEntries(Object.entries(COURSES).map(([c, i]) => [c, i.stock]))).toEqual(expected);
});

it('every dietary tag has its own fixed ink (catches a tag changing colour or two tags sharing one)', () => {
  const inks = Object.values(DIETARY).map((i) => i.ink);
  for (const ink of inks) expect(ink).toMatch(/^[a-z]+$/);
  expect(new Set(inks).size).toBe(inks.length);
});

it('stockClass names the stock and tolerates an unknown course (catches a crash on old data)', () => {
  expect(stockClass('drink')).toBe('stock-sky');
  expect(stockClass('nonsense' as never)).toBe('');
});

it('covers all declared tag values', () => {
  expect(Object.keys(DIETARY).sort()).toEqual(
    ['dairy-free', 'egg-free', 'gluten-free', 'halal', 'kosher', 'nut-free', 'vegan', 'vegetarian'],
  );
  expect(Object.keys(COURSES).sort()).toEqual(
    ['breakfast', 'condiment', 'dessert', 'drink', 'main', 'side', 'snack', 'sweets'],
  );
});
