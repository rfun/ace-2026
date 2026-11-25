import { describe, expect, it } from 'vitest';
import type { Recipe } from '../../domain/types';
import { activeCount, applyFilters, EMPTY_FILTERS } from './filters';

function r(id: string, over: Partial<Recipe>): Recipe {
  return {
    id, title: id, authorId: 'a1', origin: 'Nowhere', occasions: [], course: 'main', dietary: [],
    story: '', ingredients: [], steps: [], createdAt: 0, updatedAt: 0, ...over,
  };
}

const A = r('A', { dietary: ['vegan', 'nut-free'], course: 'main', origin: 'Peru', occasions: ['Potluck'], authorId: 'a1', story: 'Grandma used a Cast-Iron pan' });
const B = r('B', { dietary: ['vegan'], course: 'dessert', origin: 'Kenya', occasions: ['Diwali', 'Potluck'], authorId: 'a2' });
const C = r('C', { dietary: [], course: 'main', origin: 'Peru', occasions: [], authorId: 'a2', title: 'Plain Soup' });
const ALL = [A, B, C];
const ids = (rs: Recipe[]) => rs.map((x) => x.id);

describe('applyFilters', () => {
  it('empty filters return every recipe (catches a default that hides cards)', () => {
    expect(ids(applyFilters(ALL, EMPTY_FILTERS))).toEqual(['A', 'B', 'C']);
  });
  it('dietary requires every selected tag (catches any-of instead of all-of)', () => {
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, dietary: ['vegan'] }))).toEqual(['A', 'B']);
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, dietary: ['vegan', 'nut-free'] }))).toEqual(['A']);
  });
  it('courses are OR within the group', () => {
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, courses: ['dessert', 'main'] }))).toEqual(['A', 'B', 'C']);
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, courses: ['dessert'] }))).toEqual(['B']);
  });
  it('origins are OR within the group', () => {
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, origins: ['Kenya', 'Peru'] }))).toEqual(['A', 'B', 'C']);
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, origins: ['Kenya'] }))).toEqual(['B']);
  });
  it('occasions match when any occasion of the recipe is selected', () => {
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, occasions: ['Diwali'] }))).toEqual(['B']);
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, occasions: ['Potluck'] }))).toEqual(['A', 'B']);
  });
  it('contributor keeps only that author', () => {
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, authorId: 'a2' }))).toEqual(['B', 'C']);
  });
  it('groups combine with AND (catches OR across groups)', () => {
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, dietary: ['vegan'], origins: ['Peru'] }))).toEqual(['A']);
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, courses: ['main'], authorId: 'a2' }))).toEqual(['C']);
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, dietary: ['vegan'], courses: ['dessert'], origins: ['Peru'] }))).toEqual([]);
  });
  it('text search is case-insensitive over title, origin, occasion and story', () => {
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, text: 'PLAIN' }))).toEqual(['C']);
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, text: 'kenya' }))).toEqual(['B']);
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, text: 'diwali' }))).toEqual(['B']);
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, text: 'cast-iron' }))).toEqual(['A']);
    expect(ids(applyFilters(ALL, { ...EMPTY_FILTERS, text: 'zzz' }))).toEqual([]);
  });
  it('whitespace-only text does not filter', () => {
    expect(applyFilters(ALL, { ...EMPTY_FILTERS, text: '   ' })).toHaveLength(3);
  });
  it('does not mutate its input', () => {
    const copy = [...ALL];
    applyFilters(ALL, { ...EMPTY_FILTERS, dietary: ['vegan'] });
    expect(ALL).toEqual(copy);
  });
});

describe('activeCount', () => {
  it('counts each selected value and text/contributor once', () => {
    expect(activeCount(EMPTY_FILTERS)).toBe(0);
    expect(activeCount({ ...EMPTY_FILTERS, dietary: ['vegan', 'halal'], origins: ['Peru'], authorId: 'a1', text: 'x' })).toBe(5);
  });
});

describe('applyFilters text search', () => {
  const S = (text: string, names: Record<string, string> = {}, list: Recipe[] = ALL) =>
    ids(applyFilters(list, { ...EMPTY_FILTERS, text }, names));
  const fish = r('F', {
    title: 'Pad Thai', authorId: 'jeff',
    ingredients: [{ quantity: '2 tbsp', item: 'Fish Sauce' }, { quantity: '200 g', item: 'rice noodles' }],
    steps: [{ id: 's1', text: 'Stir fry until the noodles are glossy' }, { id: 's2', text: 'Serve with lime' }],
  });
  const cafe = r('G', { title: 'Cr\u00e8me br\u00fbl\u00e9e', authorId: 'amelie' });
  const L = [A, B, C, fish, cafe];

  it('matches the author display name from the names map (catches search ignoring people)', () => {
    expect(S('jeff', { jeff: 'Jeff Rivera' }, L)).toEqual(['F']);
    expect(S('jeff', {}, L)).toEqual([]);
  });
  it('matches an ingredient item (catches ingredients not searched)', () => {
    expect(S('fish sauce', {}, L)).toEqual(['F']);
  });
  it('does not match quantity text (catches quantities leaking into search)', () => {
    expect(S('tbsp', {}, L)).toEqual([]);
    expect(S('200', {}, L)).toEqual([]);
  });
  it('matches step text (catches steps not searched)', () => {
    expect(S('glossy', {}, L)).toEqual(['F']);
    expect(S('lime', {}, L)).toEqual(['F']);
  });
  it('still matches title, origin, occasion and story (catches a regression of the old fields)', () => {
    expect(S('plain soup', {}, L)).toEqual(['C']);
    expect(S('kenya', {}, L)).toEqual(['B']);
    expect(S('diwali', {}, L)).toEqual(['B']);
    expect(S('cast-iron', {}, L)).toEqual(['A']);
  });
  it('is case-insensitive and accent-insensitive in both directions (catches exact-case or accent-sensitive match)', () => {
    expect(S('CREME BRULEE', {}, L)).toEqual(['G']);
    expect(S('creme', {}, L)).toEqual(['G']);
    expect(S('Cr\u00c8ME', {}, L)).toEqual(['G']);
    expect(S('FISH', {}, L)).toEqual(['F']);
  });
  it('ANDs words across different fields (catches OR matching or single-field matching)', () => {
    expect(S('fish sauce noodles', {}, L)).toEqual(['F']);
    expect(S('jeff lime', { jeff: 'Jeff Rivera' }, L)).toEqual(['F']);
    expect(S('fish kenya', {}, L)).toEqual([]);
  });
  it('words do not match across a field boundary (catches joined fields forming false hits)', () => {
    // "thai" ends the title, "fish" starts the first ingredient: "thaifish" must not match
    expect(S('thaifish', {}, L)).toEqual([]);
  });
  it('blank or whitespace-only text matches everything', () => {
    expect(S('   ', {}, L)).toEqual(['A', 'B', 'C', 'F', 'G']);
  });
  it('author id filter ANDs with text and keeps two same-named people apart (catches name-based author filter)', () => {
    const names = { x1: 'Sam Lee', x2: 'Sam Lee' };
    const p = r('P', { authorId: 'x1', title: 'Soup' });
    const q = r('Q', { authorId: 'x2', title: 'Soup' });
    expect(ids(applyFilters([p, q], { ...EMPTY_FILTERS, authorId: 'x2' }, names))).toEqual(['Q']);
    expect(ids(applyFilters([p, q], { ...EMPTY_FILTERS, authorId: 'x2', text: 'sam' }, names))).toEqual(['Q']);
    expect(ids(applyFilters([p, q], { ...EMPTY_FILTERS, authorId: 'x2', text: 'nomatch' }, names))).toEqual([]);
  });
});

describe('keyword filter', () => {
  const X = r('X', { tags: ['noodles', 'soup'], course: 'main' });
  const Y = r('Y', { tags: ['soup'], course: 'dessert' });
  const Z = r('Z', {}); // no tags key at all (older recipe)
  const T = [X, Y, Z];
  // Catches: a recipe without a tags key crashing the filter or text search.
  it('recipes with no tags are handled', () => {
    expect(ids(applyFilters(T, { ...EMPTY_FILTERS, tags: ['soup'] }))).toEqual(['X', 'Y']);
    expect(ids(applyFilters(T, EMPTY_FILTERS))).toEqual(['X', 'Y', 'Z']);
  });
  // Catches: AND within the keyword group (would drop Y) instead of OR.
  it('is OR within the group', () => {
    expect(ids(applyFilters(T, { ...EMPTY_FILTERS, tags: ['noodles', 'soup'] }))).toEqual(['X', 'Y']);
    expect(ids(applyFilters(T, { ...EMPTY_FILTERS, tags: ['noodles'] }))).toEqual(['X']);
  });
  // Catches: keywords ignoring the other groups instead of ANDing with them.
  it('is AND across groups', () => {
    expect(ids(applyFilters(T, { ...EMPTY_FILTERS, tags: ['soup'], courses: ['dessert'] }))).toEqual(['Y']);
    expect(ids(applyFilters(T, { ...EMPTY_FILTERS, tags: ['soup'], text: 'noodles' }))).toEqual(['X']);
  });
  // Catches: tags not part of text search (the council "noodles or soup" request).
  it('text search matches a keyword that appears nowhere else', () => {
    expect(ids(applyFilters(T, { ...EMPTY_FILTERS, text: 'NOODLES' }))).toEqual(['X']);
  });
  // Catches: selected keywords not counted in the Filters (n) badge.
  it('counts each selected keyword as an active filter', () => {
    expect(activeCount({ ...EMPTY_FILTERS, tags: ['a', 'b'], courses: ['main'] })).toBe(3);
  });
});
