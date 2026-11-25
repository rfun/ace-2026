import { describe, expect, it } from 'vitest';
import type { Recipe } from '../../domain/types';
import { activeCount, applyFilters, EMPTY_FILTERS, isNew, sortRecipes } from './filters';

function r(id: string, over: Partial<Recipe> = {}): Recipe {
  return {
    id, title: id, authorId: 'a1', origin: 'Nowhere', occasions: [], course: 'main', dietary: [],
    story: '', ingredients: [], steps: [], createdAt: 0, updatedAt: 0, ...over,
  };
}
const ids = (rs: Recipe[]) => rs.map((x) => x.id);
const f = (p: Partial<typeof EMPTY_FILTERS>) => ({ ...EMPTY_FILTERS, ...p });
const HOUR = 3600_000;
const WEEK = 7 * 24 * HOUR;

describe('shelf, mine and new filters', () => {
  const NOW = 1_000_000_000_000;
  const mk = (id: string, over: Partial<Recipe> = {}) => r(id, { createdAt: NOW - 30 * 24 * HOUR, ...over });
  const S = [mk('want'), mk('made'), mk('none'), mk('noted')];
  const ctx = { meId: 'me', shelf: { want: ['want'], made: ['made'] }, now: NOW, madeNoteIds: new Set(['noted']) };

  // Catches: want filter reading the made list or returning everything.
  it('want shows only my want list', () => {
    expect(ids(applyFilters(S, f({ shelf: 'want' }), {}, ctx))).toEqual(['want']);
  });
  // Catches: made ignoring a made note that has no shelf entry.
  it('made shows my made list and recipes I wrote a made note on', () => {
    expect(ids(applyFilters(S, f({ shelf: 'made' }), {}, ctx))).toEqual(['made', 'noted']);
  });
  // Catches: Not tried including a recipe that is on a list or has my note.
  it('not tried excludes both lists and my made notes', () => {
    expect(ids(applyFilters(S, f({ shelf: 'untried' }), {}, ctx))).toEqual(['none']);
    expect(ids(applyFilters(S, f({ shelf: 'untried' }), {}, { ...ctx, madeNoteIds: undefined }))).toEqual(['none', 'noted']);
  });
  // Catches: a failed shelf load hiding every card.
  it('ignores the shelf choice when no shelf is available', () => {
    expect(applyFilters(S, f({ shelf: 'want' }), {}, { now: NOW })).toHaveLength(4);
  });
  // Catches: mine matching everyone, or matching when the viewer is unknown.
  it('mine keeps only my recipes', () => {
    const rs = [mk('a', { authorId: 'me' }), mk('b', { authorId: 'x' })];
    expect(ids(applyFilters(rs, f({ mine: true }), {}, { meId: 'me' }))).toEqual(['a']);
    expect(ids(applyFilters(rs, f({ mine: true }), {}, {}))).toEqual([]);
  });
  // Catches: off-by-one at the 7-day edge (in at exactly 7 days, out at 7 days + 1 ms).
  it('new this week boundary', () => {
    const rs = [mk('exact', { createdAt: NOW - WEEK }), mk('over', { createdAt: NOW - WEEK - 1 }), mk('fresh', { createdAt: NOW - 1000 })];
    expect(ids(applyFilters(rs, f({ fresh: true }), {}, { now: NOW }))).toEqual(['exact', 'fresh']);
    expect(isNew(rs[1], NOW)).toBe(false);
  });
  // Catches: the new filters OR-ing with each other or with other groups instead of AND.
  it('combines shelf, mine, new and an existing group with AND', () => {
    const rs = [
      mk('hit', { authorId: 'me', createdAt: NOW - 1000, course: 'main' }),
      mk('old', { authorId: 'me', course: 'main' }),
      mk('other', { authorId: 'x', createdAt: NOW - 1000, course: 'main' }),
      mk('dessert', { authorId: 'me', createdAt: NOW - 1000, course: 'dessert' }),
      mk('unlisted', { authorId: 'me', createdAt: NOW - 1000, course: 'main' }),
    ];
    const c = { meId: 'me', now: NOW, shelf: { want: ['hit', 'old', 'other', 'dessert'], made: [] } };
    expect(ids(applyFilters(rs, f({ shelf: 'want', mine: true, fresh: true, courses: ['main'] }), {}, c))).toEqual(['hit']);
  });
  // Catches: activeCount missing a new group (filters badge and Clear all would be wrong).
  it('counts each new filter once', () => {
    expect(activeCount(f({ shelf: 'want', mine: true, fresh: true }))).toBe(3);
    expect(activeCount(EMPTY_FILTERS)).toBe(0);
  });
});

describe('sortRecipes', () => {
  const rs = [
    r('old-popular', { createdAt: 1 }), r('new-none', { createdAt: 9 }), r('mid-want', { createdAt: 5 }),
    r('tie-new', { createdAt: 8 }), r('tie-old', { createdAt: 2 }),
  ];
  const stats = {
    'old-popular': { madeBy: 3, wantCount: 0 },
    'mid-want': { madeBy: 0, wantCount: 4 },
    'tie-new': { madeBy: 1, wantCount: 2 },
    'tie-old': { madeBy: 1, wantCount: 2 },
  };
  // Catches: wrong key order (wantCount before madeBy), or missing newest tiebreak.
  it('most made orders by madeBy, then wantCount, then newest', () => {
    expect(ids(sortRecipes(rs, 'most-made', stats))).toEqual(['old-popular', 'tie-new', 'tie-old', 'mid-want', 'new-none']);
  });
  // Catches: most-made leaking into newest, or mutating the input array.
  it('newest orders by createdAt and does not mutate the input', () => {
    const copy = [...rs];
    expect(ids(sortRecipes(rs, 'newest', stats))).toEqual(['new-none', 'tie-new', 'mid-want', 'tie-old', 'old-popular']);
    expect(rs).toEqual(copy);
  });
  // Catches: crash or odd order when stats are missing (failed load): must equal newest.
  it('with no stats most made falls back to newest', () => {
    expect(ids(sortRecipes(rs, 'most-made', {}))).toEqual(['new-none', 'tie-new', 'mid-want', 'tie-old', 'old-popular']);
  });
  // Catches: wantCount alone outranking a made count of 1 against 0.
  it('one made beats any number of wants', () => {
    const two = [r('wants', { createdAt: 5 }), r('made', { createdAt: 1 })];
    expect(ids(sortRecipes(two, 'most-made', { wants: { madeBy: 0, wantCount: 9 }, made: { madeBy: 1, wantCount: 0 } }))).toEqual(['made', 'wants']);
  });
});
