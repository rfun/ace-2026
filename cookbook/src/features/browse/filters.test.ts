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
