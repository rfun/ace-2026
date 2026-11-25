import { describe, expect, it } from 'vitest';
import { MAX_TAGS, normalizeTag, normalizeTags, TAG_MAX_LENGTH } from '../../domain/types';
import { addTags, TAG_TOO_LONG, TAG_TOO_MANY } from './tagInput';
import { blankForm, formFromRecipe, isBlankForm, toDraft } from './form';
import { mergeImported } from './importMerge';
import { SAMPLE_RECIPES } from '../../data/mock/samples';

describe('normalizeTag / normalizeTags', () => {
  // Catches: "Noodles " and "noodles" counted as different tags, or inner double spaces surviving into the filter list.
  it('trims, lower-cases and collapses inner whitespace', () => {
    expect(normalizeTag('  Rice   NOODLES\t')).toBe('rice noodles');
  });
  // Catches: empties or repeats (after normalising) being stored.
  it('drops empties and case-insensitive duplicates, keeping first-seen order', () => {
    expect(normalizeTags(['Soup', '  ', 'soup', 'SOUP ', 'noodles', ''])).toEqual(['soup', 'noodles']);
  });
  // Catches: the 24-character boundary being off by one in either direction.
  it('keeps a 24-character tag and drops a 25-character one', () => {
    expect(normalizeTags(['a'.repeat(TAG_MAX_LENGTH)])).toEqual(['a'.repeat(24)]);
    expect(normalizeTags(['a'.repeat(TAG_MAX_LENGTH + 1)])).toEqual([]);
  });
  // Catches: the 10-tag cap being 9 or 11, or dropping the first instead of the extras.
  it('keeps at most 10 tags, the first ten', () => {
    const many = Array.from({ length: 12 }, (_, i) => `t${i}`);
    expect(normalizeTags(many)).toEqual(many.slice(0, 10));
    expect(MAX_TAGS).toBe(10);
  });
});

describe('addTags (the chip input rules)', () => {
  // Catches: paste of "noodles, soup" adding only the first word or a single "noodles, soup" chip.
  it('splits on commas and adds each as its own tag', () => {
    expect(addTags([], 'noodles, soup').tags).toEqual(['noodles', 'soup']);
  });
  it('splits on line breaks too (a pasted list)', () => {
    expect(addTags([], 'noodles\r\nsoup\nrice').tags).toEqual(['noodles', 'soup', 'rice']);
  });
  // Catches: duplicate chips, and a duplicate raising a scary error.
  it('skips duplicates and empty pieces silently', () => {
    const r = addTags(['soup'], ' Soup, ,, noodles');
    expect(r.tags).toEqual(['soup', 'noodles']);
    expect(r.error).toBeUndefined();
    expect(r.leftover).toBe('');
  });
  // Catches: an over-long word vanishing without a message, or being cut mid-word.
  it('rejects a 25-character keyword with a message and leaves it in the box', () => {
    const long = 'b'.repeat(25);
    const r = addTags([], `soup, ${long}`);
    expect(r.tags).toEqual(['soup']);
    expect(r.error).toBe(TAG_TOO_LONG);
    expect(r.leftover).toBe(long);
  });
  it('accepts exactly 24 characters', () => {
    expect(addTags([], 'c'.repeat(24)).tags).toEqual(['c'.repeat(24)]);
  });
  // Catches: an 11th keyword slipping in, or the limit hit silently.
  it('refuses an 11th keyword with a message and keeps the typed word', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const r = addTags(ten, 'extra');
    expect(r.tags).toEqual(ten);
    expect(r.error).toBe(TAG_TOO_MANY);
    expect(r.leftover).toBe('extra');
  });
  it('accepts the 10th keyword (boundary)', () => {
    const nine = Array.from({ length: 9 }, (_, i) => `t${i}`);
    expect(addTags(nine, 'tenth').tags).toHaveLength(10);
  });
  // Catches: a paste of 12 words adding all 12.
  it('stops at the limit in the middle of a paste', () => {
    const r = addTags([], Array.from({ length: 12 }, (_, i) => `w${i}`).join(','));
    expect(r.tags).toHaveLength(10);
    expect(r.leftover).toBe('w10, w11');
    expect(r.error).toBe(TAG_TOO_MANY);
  });
});

describe('form <-> recipe tags', () => {
  const ladoo = SAMPLE_RECIPES.find((r) => r.id === 'r-besan-ladoo')!;
  // Catches: editing a tagged recipe opening with an empty Keywords field.
  it('formFromRecipe pre-fills tags, and a recipe with none gives []', () => {
    expect(formFromRecipe(ladoo).tags).toEqual(ladoo.tags);
    expect(formFromRecipe({ ...ladoo, tags: undefined }).tags).toEqual([]);
  });
  // Catches: raw chip text reaching the store un-normalised, or an empty tags array being stored.
  it('toDraft normalises tags and omits the key when there are none', () => {
    const f = { ...formFromRecipe(ladoo), tags: [' Soup ', 'soup', 'NOODLES'] };
    expect(toDraft(f).tags).toEqual(['soup', 'noodles']);
    expect('tags' in toDraft({ ...f, tags: [] })).toBe(false);
  });
  // Catches: a form with only keywords being treated as blank (draft not saved, nothing to lose warning skipped).
  it('a form with only a keyword is not blank', () => {
    expect(isBlankForm(blankForm())).toBe(true);
    expect(isBlankForm({ ...blankForm(), tags: ['soup'] })).toBe(false);
  });
});

describe('mergeImported keywords', () => {
  // Catches: Claude's suggestions replacing the keywords the member already chose.
  it('fills tags only into an empty Keywords field', () => {
    const empty = mergeImported(blankForm(), { tags: ['noodles', 'soup'] });
    expect(empty.form.tags).toEqual(['noodles', 'soup']);
    expect(empty.filled).toContain('keywords');
    const mine = mergeImported({ ...blankForm(), tags: ['mine'] }, { tags: ['noodles'] });
    expect(mine.form.tags).toEqual(['mine']);
    expect(mine.filled).not.toContain('keywords');
  });
});
