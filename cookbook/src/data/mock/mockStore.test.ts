import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockStore } from './mockStore';
import type { MadeNote, Me, Recipe, RecipeDraft, Tip } from '../../domain/types';

const base = { origin: 'Nowhere', occasions: [], course: 'main', dietary: [], story: 's', ingredients: [], steps: [] } as const;
const recipe = (id: string, authorId: string, extra: Partial<Recipe> = {}): Recipe => ({
  ...base, occasions: [], dietary: [], ingredients: [], steps: [],
  id, title: `T-${id}`, authorId, createdAt: 1, updatedAt: 1, ...extra,
});
const draft = (title: string): RecipeDraft => ({ ...base, occasions: [], dietary: [], ingredients: [], steps: [], title });
const tip = (id: string, recipeId: string, createdAt: number, extra: Partial<Tip> = {}): Tip => ({
  id, recipeId, authorId: 'u-other', text: id, createdAt, ...extra,
});
const user: Me = { id: 'u-you', canWrite: true, canModerate: false };
const mod: Me = { id: 'u-mod', canWrite: true, canModerate: true };

beforeEach(() => window.localStorage.clear());

describe('listRecipes visibility', () => {
  const recipes = [recipe('a', 'u-other'), recipe('b', 'u-other', { hidden: true })];
  it('hides hidden recipes from non-moderators (catches leaking moderated content)', async () => {
    const s = createMockStore({ me: user, recipes, tips: [] });
    expect((await s.listRecipes()).map((r) => r.id)).toEqual(['a']);
  });
  it('shows hidden recipes to moderators (catches moderators unable to unhide)', async () => {
    const s = createMockStore({ me: mod, recipes, tips: [] });
    expect((await s.listRecipes()).map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('getRecipe', () => {
  it('returns null for an unknown id (catches throwing/undefined on missing)', async () => {
    expect(await createMockStore({ recipes: [], tips: [] }).getRecipe('nope')).toBeNull();
  });
});

describe('saveRecipe', () => {
  it('creates with id, authorId = me, timestamps (catches client-supplied authorship)', async () => {
    const s = createMockStore({ me: user, recipes: [], tips: [] });
    const before = Date.now();
    const r = await s.saveRecipe(draft('New'));
    expect(r.id).toBeTruthy();
    expect(r.authorId).toBe('u-you');
    expect(r.createdAt).toBeGreaterThanOrEqual(before);
    expect(r.updatedAt).toBe(r.createdAt);
    expect(await s.getRecipe(r.id)).toEqual(r);
  });
  it('lets the author update, keeping authorId and createdAt', async () => {
    const s = createMockStore({ me: user, recipes: [recipe('a', 'u-you')], tips: [] });
    const r = await s.saveRecipe({ ...draft('Renamed'), id: 'a' });
    expect(r.title).toBe('Renamed');
    expect(r.authorId).toBe('u-you');
    expect(r.createdAt).toBe(1);
    expect(r.updatedAt).toBeGreaterThan(1);
  });
  it("rejects updating someone else's recipe with not-author (fails if the author check is removed)", async () => {
    const s = createMockStore({ me: user, recipes: [recipe('a', 'u-other')], tips: [] });
    await expect(s.saveRecipe({ ...draft('Hijack'), id: 'a' })).rejects.toThrow('not-author');
    expect((await s.getRecipe('a'))?.title).toBe('T-a');
  });
  it("rejects a moderator editing someone else's recipe with not-author (catches the moderator edit override coming back)", async () => {
    const s = createMockStore({ me: mod, recipes: [recipe('a', 'u-other')], tips: [] });
    await expect(s.saveRecipe({ ...draft('Edited'), id: 'a' })).rejects.toThrow('not-author');
    expect((await s.getRecipe('a'))?.title).toBe('T-a');
  });
});

describe('tips', () => {
  it('addTip attributes to me (catches spoofable authorship)', async () => {
    const s = createMockStore({ me: user, recipes: [], tips: [] });
    const t = await s.addTip('r1', { text: 'hello' });
    expect(t.authorId).toBe('u-you');
    expect(t.recipeId).toBe('r1');
    expect(t.text).toBe('hello');
  });
  it('listTips is oldest-first and scoped to the recipe (catches ordering/filter bugs)', async () => {
    const s = createMockStore({
      me: user, recipes: [],
      tips: [tip('late', 'r1', 30), tip('early', 'r1', 10), tip('other', 'r2', 20), tip('mid', 'r1', 20)],
    });
    expect((await s.listTips('r1')).map((t) => t.id)).toEqual(['early', 'mid', 'late']);
  });
  it('excludes hidden tips for non-moderators only', async () => {
    const tips = [tip('ok', 'r1', 1), tip('bad', 'r1', 2, { hidden: true })];
    expect((await createMockStore({ me: user, recipes: [], tips }).listTips('r1')).map((t) => t.id)).toEqual(['ok']);
    expect((await createMockStore({ me: mod, recipes: [], tips }).listTips('r1')).map((t) => t.id)).toEqual(['ok', 'bad']);
  });
});

describe('setHidden', () => {
  it('moderator can hide a recipe so users stop seeing it; non-moderator is forbidden', async () => {
    const recipes = [recipe('a', 'u-other')];
    const m = createMockStore({ me: mod, recipes, tips: [] });
    await m.setHidden('recipe', 'a', true);
    expect((await m.getRecipe('a'))?.hidden).toBe(true);
    await expect(createMockStore({ me: user, recipes, tips: [] }).setHidden('recipe', 'a', true)).rejects.toThrow('forbidden');
  });
});

describe('subscribe', () => {
  it('fires after every write and stops after unsubscribe (catches missed/leaked notifications)', async () => {
    const s = createMockStore({ me: mod, recipes: [recipe('a', 'u-you')], tips: [] });
    const fn = vi.fn();
    const off = s.subscribe(fn);
    await s.saveRecipe(draft('x'));
    await s.addTip('a', { text: 't' });
    await s.setHidden('recipe', 'a', true);
    expect(fn).toHaveBeenCalledTimes(3);
    off();
    await s.addTip('a', { text: 'again' });
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('persist', () => {
  it('state survives a new store instance via localStorage (catches non-persisting writes)', async () => {
    const a = createMockStore({ persist: true, recipes: [], tips: [] });
    const saved = await a.saveRecipe(draft('Kept'));
    await a.addTip(saved.id, { text: 'kept tip' });
    const b = createMockStore({ persist: true, recipes: [], tips: [] });
    expect((await b.getRecipe(saved.id))?.title).toBe('Kept');
    expect((await b.listTips(saved.id)).map((t) => t.text)).toEqual(['kept tip']);
  });
  // Catches: persist branch ignoring opts.recipes/opts.tips when storage is empty.
  it('persist with empty storage seeds from opts, and stored state wins afterwards', async () => {
    const a = createMockStore({ persist: true, recipes: [recipe('seed', 'u-you')], tips: [tip('ts', 'seed', 5)] });
    expect((await a.getRecipe('seed'))?.title).toBe('T-seed');
    expect((await a.listTips('seed')).map((t) => t.id)).toEqual(['ts']);
    await a.addTip('seed', { text: 'w' }); // first write persists
    const b = createMockStore({ persist: true, recipes: [recipe('other', 'u-you')], tips: [] });
    expect(await b.getRecipe('other')).toBeNull();
    expect((await b.getRecipe('seed'))?.title).toBe('T-seed');
  });
  it('without persist, a new instance starts fresh', async () => {
    const a = createMockStore({ recipes: [], tips: [] });
    const saved = await a.saveRecipe(draft('Gone'));
    expect(await createMockStore({ recipes: [], tips: [] }).getRecipe(saved.id)).toBeNull();
  });
});

describe('defaults and uploadPhoto', () => {
  it('defaults to samples and me u-you', async () => {
    const s = createMockStore();
    expect(await s.me()).toEqual({ id: 'u-you', canWrite: true, canModerate: false });
    expect((await s.listRecipes()).length).toBe(3);
  });
  it('uploadPhoto returns local-<n> asset ids with the alt text', async () => {
    const s = createMockStore();
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    const p1 = await s.uploadPhoto(new Blob(['x']), 'alt one');
    const p2 = await s.uploadPhoto(new Blob(['y']), 'alt two');
    expect(p1).toEqual({ assetId: 'local-1', url: 'blob:fake', alt: 'alt one' });
    expect(p2.assetId).toBe('local-2');
  });
  it('uploadPhoto falls back to a data: URL without URL.createObjectURL', async () => {
    const s = createMockStore();
    const original = URL.createObjectURL;
    // @ts-expect-error simulate an environment without createObjectURL
    URL.createObjectURL = undefined;
    try {
      const p = await s.uploadPhoto(new Blob(['x'], { type: 'text/plain' }), 'a');
      expect(p.url.startsWith('data:')).toBe(true);
    } finally {
      URL.createObjectURL = original;
    }
  });
});

describe('made notes and shelf', () => {
  const made = (id: string, recipeId: string, authorId: string, extra: Partial<MadeNote> = {}): MadeNote => ({
    id, recipeId, authorId, text: id, createdAt: 1, ...extra,
  });
  const fresh = (me: Me = user, extra: Parameters<typeof createMockStore>[0] = {}) =>
    createMockStore({ me, recipes: [], tips: [], made: [], shelves: {}, ...extra });

  // Catches: addMade leaving the recipe on want, or not adding it to made.
  it('addMade moves the recipe from want to made and returns the note authored by me', async () => {
    const s = fresh(user, { shelves: { 'u-you': { want: ['r1', 'r2'], made: [] } } });
    const n = await s.addMade('r1', { text: ' done ' });
    expect(n).toMatchObject({ recipeId: 'r1', authorId: 'u-you', text: 'done' });
    expect(await s.myShelf()).toEqual({ want: ['r2'], made: ['r1'] });
    expect((await s.listMade('r1')).map((x) => x.id)).toEqual([n.id]);
  });
  it('addMade rejects empty and over-600 text', async () => {
    const s = fresh();
    await expect(s.addMade('r1', { text: ' ' })).rejects.toThrow('invalid-made');
    await expect(s.addMade('r1', { text: 'x'.repeat(601) })).rejects.toThrow('invalid-made');
  });
  // Catches: hidden notes shown to members / hidden from moderators / wrong recipe / wrong order.
  it('listMade filters by recipe and hidden, oldest first', async () => {
    const notes = [made('b', 'r1', 'x', { createdAt: 2 }), made('a', 'r1', 'x', { createdAt: 1 }), made('h', 'r1', 'x', { hidden: true }), made('o', 'r2', 'x')];
    expect((await fresh(user, { made: notes }).listMade('r1')).map((n) => n.id)).toEqual(['a', 'b']);
    expect((await fresh(mod, { made: notes }).listMade('r1')).map((n) => n.id).sort()).toEqual(['a', 'b', 'h']);
  });
  // Catches: shelf states overlapping, and setShelf returning stale data.
  it('setShelf keeps want and made exclusive and none clears', async () => {
    const s = fresh();
    expect(await s.setShelf('r1', 'want')).toEqual({ want: ['r1'], made: [] });
    expect(await s.setShelf('r1', 'made')).toEqual({ want: [], made: ['r1'] });
    expect(await s.setShelf('r1', 'none')).toEqual({ want: [], made: [] });
  });
  // Catches: stats not combining my own shelf with others', or counting hidden notes.
  it('stats counts distinct makers and wanters and ignores hidden notes', async () => {
    const s = fresh(user, {
      made: [made('n1', 'r1', 'u-a'), made('n2', 'r1', 'u-b', { hidden: true })],
      shelves: { 'u-a': { want: [], made: ['r1'] }, 'u-c': { want: ['r1'], made: [] } },
    });
    await s.setShelf('r1', 'want');
    expect((await s.stats()).r1).toEqual({ madeBy: 1, wantCount: 2 });
  });
  // Catches: moderators unable to hide a made note, members able to.
  it('setHidden made requires a moderator and removes the note from stats', async () => {
    const notes = [made('n1', 'r1', 'x')];
    await expect(fresh(user, { made: notes }).setHidden('made', 'n1', true)).rejects.toThrow('forbidden');
    const s = fresh(mod, { made: notes });
    await s.setHidden('made', 'n1', true);
    expect((await s.listMade('r1'))[0].hidden).toBe(true);
    expect(await s.stats()).toEqual({});
  });
  // Catches: persisted state from before this feature crashing, and shelf changes not persisting.
  it('persists the shelf and loads an old saved state without made or shelves', async () => {
    const s1 = createMockStore({ me: user, persist: true, recipes: [], tips: [], made: [], shelves: {} });
    await s1.setShelf('r1', 'want');
    expect(await createMockStore({ me: user, persist: true }).myShelf()).toEqual({ want: ['r1'], made: [] });
    window.localStorage.setItem('ace-culture-cookbook:mock-store:v1', JSON.stringify({ recipes: [], tips: [], counter: 0 }));
    const old = createMockStore({ me: user, persist: true });
    expect(await old.myShelf()).toEqual({ want: [], made: [] });
    expect(await old.stats()).toEqual({});
  });
  // Catches: dev seeds missing, so the UI has nothing to show.
  it('default seed has a made note on a sample recipe and a shelf for the signed-in user', async () => {
    const s = createMockStore();
    expect((await s.listMade('r-besan-ladoo')).length).toBeGreaterThan(0);
    const shelf = await s.myShelf();
    expect(shelf.want.length + shelf.made.length).toBeGreaterThan(0);
    expect((await s.stats())['r-besan-ladoo'].madeBy).toBeGreaterThan(0);
  });
});
