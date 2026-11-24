import { describe, expect, it } from 'vitest';
import { scaleQuantity } from './scaleQuantity';

// Every expected value below is worked out by hand, not by running the library.
describe('scaleQuantity: shapes it understands', () => {
  it.each([
    ['2 cups', 2, '4 cups'], // integer
    ['3 eggs', 1.5, '4½ eggs'], // 4.5 -> 4 and a half
    ['1.5 kg', 2, '3 kg'], // decimal in, decimal out, trailing zero trimmed
    ['1.5 kg', 3, '4.5 kg'],
    ['0.25 tsp', 3, '0.75 tsp'],
    ['½ cup', 2, '1 cup'], // vulgar fraction alone
    ['½ cup', 3, '1½ cup'],
    ['¾ cup', 2, '1½ cup'],
    ['⅓ cup', 2, '⅔ cup'],
    ['⅛ tsp', 2, '¼ tsp'],
    ['1½ cups', 2, '3 cups'], // glued mixed number
    ['1 ½ cups', 2, '3 cups'], // spaced mixed number
    ['1/2 cup', 2, '1 cup'], // ASCII fraction
    ['1 1/2 cups', 2, '3 cups'],
    ['1 1/2 cups', 3, '4½ cups'],
    ['1/4 tsp', 3, '¾ tsp'],
    ['2 cup', 0.5, '1 cup'], // units are kept as written, never re-pluralised
    ['1 cup', 0.25, '¼ cup'],
    ['2 cups', 1 / 3, '⅔ cups'],
    ['2 cups', 1.125, '2¼ cups'], // 2.25
  ])('%j x %j -> %j', (input, factor, expected) => {
    expect(scaleQuantity(input, factor)).toEqual({ text: expected, scaled: true });
  });

  it.each([
    ['1-2 tbsp', 2, '2-4 tbsp'],
    ['1 – 2 tbsp', 2, '2 – 4 tbsp'], // en dash with spaces kept as written
    ['2 to 3 cloves', 2, '4 to 6 cloves'],
    ['1/2-1 cup', 2, '1-2 cup'],
    ['1-2 cups', 1.5, '1½-3 cups'],
  ])('range %j x %j -> %j', (input, factor, expected) => {
    expect(scaleQuantity(input, factor)).toEqual({ text: expected, scaled: true });
  });

  it('scales only the leading number: the rest of the text is untouched', () => {
    expect(scaleQuantity('2 (400g) cans', 2).text).toBe('4 (400g) cans');
    expect(scaleQuantity('3 x 15 ml spoons', 2).text).toBe('6 x 15 ml spoons');
  });

  it('keeps leading spaces and a unit glued to the number', () => {
    expect(scaleQuantity('  2 cups', 2).text).toBe('  4 cups');
    expect(scaleQuantity('250g', 2).text).toBe('500g');
  });

  it('does not read "2-3/4" as a range from 2 to 3/4: only the first number moves', () => {
    expect(scaleQuantity('2-3/4 cup', 2).text).toBe('4-3/4 cup');
  });
});

describe('scaleQuantity: output rounding', () => {
  it.each([
    [1 / 8, '⅛'],
    [0.3, '⅓'], // nearer 1/3 than 1/4
    [0.26, '¼'],
    [0.6, '⅔'],
    [0.7, '⅔'], // nearer 2/3 than 3/4
    [0.72, '¾'],
    [0.95, '1'], // rounds up to the next whole number
    [2.95, '3'],
  ])('1 cup x %j shows %j', (value, expected) => {
    expect(scaleQuantity('1 cup', value).text).toBe(`${expected} cup`);
  });

  it('never shows 0 for an integer or fraction: the smallest fraction instead', () => {
    expect(scaleQuantity('1 tsp', 0.01).text).toBe('⅛ tsp');
    expect(scaleQuantity('1/8 tsp', 0.1).text).toBe('⅛ tsp');
  });

  it('never shows 0 for a decimal: keeps 2 decimal places', () => {
    expect(scaleQuantity('0.5 g', 0.001).text).toBe('0.01 g');
  });

  it('limits decimals to 2 places', () => {
    expect(scaleQuantity('1.5 kg', 1 / 3).text).toBe('0.5 kg');
    expect(scaleQuantity('1.1 kg', 1 / 3).text).toBe('0.37 kg');
  });
});

describe('scaleQuantity: things it leaves alone', () => {
  it.each(['a pinch', 'to taste', '', 'Pinch of salt', 'juice of 1 lemon', '—'])('%j has no leading number', (text) => {
    expect(scaleQuantity(text, 3)).toEqual({ text, scaled: false });
  });

  it('factor 1 returns the text byte for byte', () => {
    for (const t of ['1 1/2 cups', '1½ cups', '  2 (400g) cans', '1 – 2', '1.50 kg']) {
      expect(scaleQuantity(t, 1).text).toBe(t);
    }
  });

  it('zero amounts and zero denominators are not scaled', () => {
    expect(scaleQuantity('0 cups', 2)).toEqual({ text: '0 cups', scaled: false });
    expect(scaleQuantity('1/0 cup', 2)).toEqual({ text: '1/0 cup', scaled: false });
  });

  it.each([0, -1, NaN, Infinity])('a nonsense factor %j changes nothing', (f) => {
    expect(scaleQuantity('2 cups', f).text).toBe('2 cups');
  });
});
