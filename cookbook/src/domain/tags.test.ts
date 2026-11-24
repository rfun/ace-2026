import { describe, expect, it } from 'vitest';
import { COURSES, DIETARY } from './tags';

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

it('covers all declared tag values', () => {
  expect(Object.keys(DIETARY).sort()).toEqual(
    ['dairy-free', 'egg-free', 'gluten-free', 'halal', 'kosher', 'nut-free', 'vegan', 'vegetarian'],
  );
  expect(Object.keys(COURSES).sort()).toEqual(
    ['breakfast', 'condiment', 'dessert', 'drink', 'main', 'side', 'snack', 'sweets'],
  );
});
