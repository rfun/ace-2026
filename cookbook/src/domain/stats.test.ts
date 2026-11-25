import { describe, expect, it } from 'vitest';
import { applyShelfState, computeStats } from './stats';
import type { MadeNote, Shelf } from './types';

const note = (id: string, recipeId: string, authorId: string, extra: Partial<MadeNote> = {}): MadeNote => ({
  id, recipeId, authorId, text: 'x', createdAt: 1, ...extra,
});
const shelf = (want: string[], made: string[]): Shelf => ({ want, made });

describe('computeStats', () => {
  // Catches: counting a person twice when they both posted a note and ticked Made-it.
  it('counts a person who both noted and ticked the recipe once', () => {
    const s = computeStats([note('n1', 'r1', 'a')], { a: shelf([], ['r1']) });
    expect(s).toEqual({ r1: { madeBy: 1, wantCount: 0 } });
  });
  // Catches: counting one person's several notes as several makers.
  it('counts two notes by the same person once', () => {
    expect(computeStats([note('n1', 'r1', 'a'), note('n2', 'r1', 'a')], {}).r1.madeBy).toBe(1);
  });
  // Catches: hidden (moderated) notes inflating the count.
  it('does not count a hidden note', () => {
    expect(computeStats([note('n1', 'r1', 'a', { hidden: true }), note('n2', 'r1', 'b')], {}).r1.madeBy).toBe(1);
  });
  // Catches: a hidden note wiping out the same person's made-shelf entry.
  it('a hidden note does not erase the same person made-shelf entry', () => {
    expect(computeStats([note('n1', 'r1', 'a', { hidden: true })], { a: shelf([], ['r1']) }).r1.madeBy).toBe(1);
  });
  // Catches: summing notes and shelves instead of taking distinct people.
  it('unions people across notes and shelves', () => {
    const s = computeStats([note('n1', 'r1', 'a')], { b: shelf([], ['r1']), c: shelf([], ['r1']) });
    expect(s.r1.madeBy).toBe(3);
  });
  it('counts want separately from made', () => {
    const s = computeStats([], { a: shelf(['r1'], []), b: shelf(['r1'], []), c: shelf([], ['r1']) });
    expect(s.r1).toEqual({ madeBy: 1, wantCount: 2 });
  });
  // Catches: a malformed shelf holding a recipe in both lists counting as want too.
  it('a recipe in both lists of one shelf counts as made only', () => {
    expect(computeStats([], { a: shelf(['r1'], ['r1']) }).r1).toEqual({ madeBy: 1, wantCount: 0 });
  });
  it('returns an empty record with no input', () => {
    expect(computeStats([], {})).toEqual({});
  });
});

describe('applyShelfState', () => {
  // Catches: made and want overlapping after a move.
  it('moves want to made and removes it from want', () => {
    expect(applyShelfState(shelf(['r1', 'r2'], []), 'r1', 'made')).toEqual({ want: ['r2'], made: ['r1'] });
  });
  it('moves made to want', () => {
    expect(applyShelfState(shelf([], ['r1']), 'r1', 'want')).toEqual({ want: ['r1'], made: [] });
  });
  it('none removes from both', () => {
    expect(applyShelfState(shelf(['r1'], ['r2']), 'r2', 'none')).toEqual({ want: ['r1'], made: [] });
  });
  // Catches: duplicates when the same state is applied twice.
  it('is idempotent (no duplicates)', () => {
    const once = applyShelfState(shelf([], []), 'r1', 'want');
    expect(applyShelfState(once, 'r1', 'want')).toEqual({ want: ['r1'], made: [] });
  });
  // Catches: mutating the caller's arrays.
  it('does not mutate its input', () => {
    const s = shelf(['r1'], []);
    applyShelfState(s, 'r1', 'made');
    expect(s).toEqual({ want: ['r1'], made: [] });
  });
});
