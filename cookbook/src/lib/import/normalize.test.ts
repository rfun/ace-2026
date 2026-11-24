import { describe, expect, it } from 'vitest';
import { normalizeImported } from './normalize';

describe('normalizeImported', () => {
  it.each([null, undefined, 'text', 5, true, [], [{ title: 'x' }]])('returns {} for non-object input %j', (v) => {
    expect(normalizeImported(v)).toEqual({});
  });

  it('drops an unknown course, including inherited object keys like "constructor"', () => {
    expect(normalizeImported({ course: 'brunch' }).course).toBeUndefined();
    expect(normalizeImported({ course: 'constructor' }).course).toBeUndefined();
    expect(normalizeImported({ course: ' Dessert ' }).course).toBe('dessert');
  });

  it('keeps only known dietary tags, once each, and drops the key if none remain', () => {
    expect(normalizeImported({ dietary: ['vegan', 'paleo', 'vegan', 'toString', 7] }).dietary).toEqual(['vegan']);
    expect(normalizeImported({ dietary: ['paleo'] })).toEqual({});
  });

  it('trims strings and caps their length', () => {
    const r = normalizeImported({ title: `  ${'a'.repeat(500)}  `, story: 's'.repeat(5000), origin: '  Goa ' });
    expect(r.title).toHaveLength(120);
    expect(r.story).toHaveLength(1500);
    expect(r.origin).toBe('Goa');
  });

  it('omits blank strings rather than returning empty fields', () => {
    expect(normalizeImported({ title: '   ', story: '', makes: 3 })).toEqual({ makes: '3' });
  });

  it('caps ingredients at 60 and steps at 40, keeping the first ones', () => {
    const r = normalizeImported({
      ingredients: Array.from({ length: 90 }, (_, i) => ({ quantity: '1', item: `i${i}` })),
      steps: Array.from({ length: 70 }, (_, i) => `step ${i}`),
    });
    expect(r.ingredients).toHaveLength(60);
    expect(r.ingredients?.[59].item).toBe('i59');
    expect(r.steps).toHaveLength(40);
    expect(r.steps?.[39]).toBe('step 39');
  });

  it('drops ingredient entries with no item and tolerates junk entries', () => {
    const r = normalizeImported({ ingredients: [{ quantity: '2' }, null, 5, { quantity: '1 cup', item: 'milk' }, '2 eggs'] });
    expect(r.ingredients).toEqual([
      { quantity: '1 cup', item: 'milk' },
      { quantity: '2', item: 'eggs' },
    ]);
  });

  it('accepts steps given as {text} objects and drops empty ones', () => {
    expect(normalizeImported({ steps: [{ text: 'Mix.' }, '  ', 'Bake.', {}] }).steps).toEqual(['Mix.', 'Bake.']);
  });

  it.each([
    [75, 75],
    [74.6, 75],
    ['90', 90],
    [2880, 2880],
    [2881, undefined],
    [0, undefined],
    [0.4, undefined],
    [-5, undefined],
    [NaN, undefined],
    ['soon', undefined],
  ])('totalMinutes %j -> %j (positive integer, at most 2880)', (input, expected) => {
    expect(normalizeImported({ totalMinutes: input }).totalMinutes).toBe(expected);
  });

  it('caps occasions at 8', () => {
    expect(normalizeImported({ occasions: Array.from({ length: 12 }, (_, i) => `o${i}`) }).occasions).toHaveLength(8);
  });

  it('does not pass unknown keys through', () => {
    expect(normalizeImported({ title: 'T', html: '<img src=x onerror=alert(1)>', __proto__: { course: 'main' } })).toEqual({ title: 'T' });
  });
});
