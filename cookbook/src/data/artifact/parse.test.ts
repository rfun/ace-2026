import { describe, expect, it } from 'vitest';
import { parseRecipe, parseTip } from './parse';

const rawRecipe = (mainPhoto?: unknown, stepPhoto?: unknown) => ({
  id: 'r1',
  title: 'Dal',
  origin: 'Punjab',
  occasions: [],
  course: 'main',
  dietary: [],
  story: 's',
  ingredients: [],
  steps: [{ id: 's1', text: 'Boil.', photo: stepPhoto }],
  createdAt: 1,
  updatedAt: 2,
  mainPhoto,
});
const rawTip = (photo?: unknown) => ({ id: 't1', recipeId: 'r1', text: 'hi', createdAt: 1, photo });

describe('asset id validation', () => {
  // Catches: a path-traversal or malformed asset id reaching the /_blob/ URL; also that the recipe/tip itself survives.
  it.each(['../x', 'a/b', '', 'a.b', 'x'.repeat(129), 'a b'])('drops the photo for assetId %j but keeps the recipe, step and tip', (bad) => {
    const photo = { assetId: bad, alt: 'x' };
    const r = parseRecipe(rawRecipe(photo, photo), 'u1');
    expect(r).not.toBeNull();
    expect(r!.mainPhoto).toBeUndefined();
    expect(r!.steps[0].photo).toBeUndefined();
    const t = parseTip(rawTip(photo), 'u1');
    expect(t).not.toBeNull();
    expect(t!.photo).toBeUndefined();
  });

  // Catches: the validator rejecting legitimate ids (uuid-like, underscores, max length).
  it.each(['asset-1', 'A_b-9', 'x'.repeat(128), '0f1e2d3c4b5a69788796a5b4c3d2e1f0'])('keeps the photo for assetId %j', (good) => {
    const r = parseRecipe(rawRecipe({ assetId: good, alt: 'pic' }), 'u1');
    expect(r!.mainPhoto).toEqual({ assetId: good, url: '/_blob/' + good, alt: 'pic' });
    expect(parseTip(rawTip({ assetId: good, alt: 'pic' }), 'u1')!.photo?.assetId).toBe(good);
  });
});

describe('serves', () => {
  const withServes = (serves: unknown) => parseRecipe({ ...rawRecipe(), serves }, 'u1')!;
  // Catches: a legacy doc without serves failing to load, or bad values becoming errors or NaN scalers.
  it('loads a doc with no serves, leaving it undefined', () => {
    const r = parseRecipe(rawRecipe(), 'u1');
    expect(r).not.toBeNull();
    expect(r!.serves).toBeUndefined();
  });
  it.each([1, 4, 100])('keeps serves %j', (n) => {
    expect(withServes(n).serves).toBe(n);
  });
  it.each([0, 101, -1, 2.5, '4', null, NaN, {}])('drops serves %j but keeps the recipe', (bad) => {
    const r = withServes(bad);
    expect(r.title).toBe('Dal');
    expect('serves' in r).toBe(false);
  });
});

describe('tags', () => {
  const withTags = (tags: unknown) => parseRecipe({ ...rawRecipe(), tags }, 'u1')!;
  // Catches: older docs (no tags key) failing to load or getting an empty array that changes saves.
  it('loads a doc with no tags, leaving tags undefined', () => {
    const r = parseRecipe(rawRecipe(), 'u1');
    expect(r).not.toBeNull();
    expect(r!.tags).toBeUndefined();
  });
  // Catches: stored tags skipping normalisation on read (case/space/duplicate variants reaching the filter list).
  it('normalises stored tags the same way as saving', () => {
    expect(withTags([' Noodles ', 'noodles', 'Rice   Soup', ''] as unknown).tags).toEqual(['noodles', 'rice soup']);
  });
  // Catches: one bad entry rejecting the whole recipe, or a number/object becoming a tag.
  it('drops non-string entries and keeps the recipe', () => {
    expect(withTags(['soup', 5, null, { a: 1 }, ['x'], 'noodles']).tags).toEqual(['soup', 'noodles']);
  });
  // Catches: a non-array tags value (string, object) throwing or being kept.
  it.each(['soup', { 0: 'soup' }, 7, null, true])('ignores non-array tags %j', (bad) => {
    const r = parseRecipe({ ...rawRecipe(), tags: bad }, 'u1');
    expect(r).not.toBeNull();
    expect(r!.tags).toBeUndefined();
  });
  // Catches: oversize stored lists (over 10, or a 25-character tag) being trusted.
  it('enforces the 10-tag and 24-character limits on read', () => {
    const many = Array.from({ length: 12 }, (_, i) => `t${i}`);
    expect(withTags(many).tags).toEqual(many.slice(0, 10));
    expect(withTags(['x'.repeat(25), 'ok']).tags).toEqual(['ok']);
  });
  // Catches: an all-invalid list leaving tags: [] behind.
  it('omits tags when nothing valid remains', () => {
    expect(withTags(['', 5]).tags).toBeUndefined();
  });
});
