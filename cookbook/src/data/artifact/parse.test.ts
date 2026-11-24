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
