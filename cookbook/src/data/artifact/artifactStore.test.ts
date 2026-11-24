import { describe, expect, it, vi } from 'vitest';
import type { RecipeDraft } from '../../domain/types';
import { createArtifactStore } from './artifactStore';
import { createFakeRuntime } from './fakeRuntime';
import { CAPABILITIES } from './runtime';

const draft = (title = 'Dal'): RecipeDraft => ({
  title,
  origin: 'Punjab',
  occasions: ['diwali'],
  course: 'main',
  dietary: ['vegan'],
  story: 'Mum made it.',
  ingredients: [{ quantity: '1 cup', item: 'lentils' }],
  steps: [{ id: 's1', text: 'Boil.' }],
});

const storedRecipe = (id: string, createdAt: number, extra: Record<string, unknown> = {}) => ({
  ...draft(id),
  id,
  createdAt,
  updatedAt: createdAt,
  ...extra,
});

describe('me()', () => {
  it('reports id, moderator and writer flags (catches mixing up canEdit/can)', async () => {
    const rt = createFakeRuntime({ userId: 'u9', canEdit: true, canWrite: true });
    expect(await createArtifactStore(rt).me()).toEqual({ id: 'u9', canModerate: true, canWrite: true });
  });
  it('canWrite false when user.can says false, true when not told (null)', async () => {
    expect((await createArtifactStore(createFakeRuntime({ canWrite: false })).me()).canWrite).toBe(false);
    expect((await createArtifactStore(createFakeRuntime({ canWrite: null })).me()).canWrite).toBe(true);
  });
  it('canWrite false when db is unavailable', async () => {
    expect((await createArtifactStore(createFakeRuntime({ db: false })).me()).canWrite).toBe(false);
  });
});

describe('people()', () => {
  it('maps empty names to Someone (catches showing blank authors)', async () => {
    const rt = createFakeRuntime({ names: { a: 'Asha' } });
    const out = await createArtifactStore(rt).people(['a', 'b']);
    expect(out).toEqual({ a: { id: 'a', name: 'Asha' }, b: { id: 'b', name: 'Someone' } });
  });
});

describe('recipes', () => {
  it('saves a new recipe into the caller doc and reads it back stamped with the doc id', async () => {
    const rt = createFakeRuntime({ userId: 'u1' });
    const store = createArtifactStore(rt);
    const saved = await store.saveRecipe(draft());
    expect(rt.setCalls).toEqual(['recipes/u1']);
    expect(saved.authorId).toBe('u1');
    expect((await store.getRecipe(saved.id))?.title).toBe('Dal');
  });
  it('edits own recipe keeping createdAt and not duplicating (catches append-on-edit)', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1000);
      const store = createArtifactStore(createFakeRuntime());
      const a = await store.saveRecipe(draft());
      vi.setSystemTime(5000);
      const b = await store.saveRecipe({ ...draft('Dal v2'), id: a.id });
      expect(b.createdAt).toBe(1000);
      expect(b.updatedAt).toBe(5000);
      const all = await store.listRecipes();
      expect(all).toHaveLength(1);
      expect(all[0].title).toBe('Dal v2');
    } finally {
      vi.useRealTimers();
    }
  });
  it("rejects editing someone else's recipe with not-author and writes nothing", async () => {
    const rt = createFakeRuntime({ userId: 'u1' });
    rt.docs.set('recipes/u2', { items: [storedRecipe('r-other', 10)] });
    await expect(createArtifactStore(rt).saveRecipe({ ...draft('hijack'), id: 'r-other' })).rejects.toThrow('not-author');
    expect(rt.setCalls).toEqual([]);
  });
  it('rejects editing an unknown id with not-found', async () => {
    await expect(createArtifactStore(createFakeRuntime()).saveRecipe({ ...draft(), id: 'nope' })).rejects.toThrow('not-found');
  });
  it('does not store hidden/sample flags or photo urls (catches trusting client-side fields)', async () => {
    const rt = createFakeRuntime();
    const store = createArtifactStore(rt);
    await store.saveRecipe({
      ...draft(),
      hidden: true,
      sample: true,
      mainPhoto: { assetId: 'a1', url: 'https://evil.test/x.png', alt: 'pic' },
    });
    const stored = (rt.docs.get('recipes/u1')!.items as Record<string, unknown>[])[0];
    expect(stored).not.toHaveProperty('hidden');
    expect(stored).not.toHaveProperty('sample');
    expect(stored.mainPhoto).toEqual({ assetId: 'a1', alt: 'pic' });
    expect((await store.listRecipes())[0].mainPhoto?.url).toBe('/_blob/a1');
  });
  it('rejects a doc growing to 240 KiB with too-large', async () => {
    const rt = createFakeRuntime();
    const big = { ...draft(), story: 'x'.repeat(250 * 1024) };
    await expect(createArtifactStore(rt).saveRecipe(big)).rejects.toThrow('too-large');
    expect(rt.setCalls).toEqual([]);
  });
  it('lists newest first across authors and ignores a forged stored authorId', async () => {
    const rt = createFakeRuntime();
    rt.docs.set('recipes/u2', { items: [storedRecipe('old', 1, { authorId: 'u1' })] });
    rt.docs.set('recipes/u3', { items: [storedRecipe('new', 9)] });
    const list = await createArtifactStore(rt).listRecipes();
    expect(list.map((r) => r.id)).toEqual(['new', 'old']);
    expect(list.find((r) => r.id === 'old')?.authorId).toBe('u2');
  });
  it('drops malformed docs and items (catches trusting db values)', async () => {
    const rt = createFakeRuntime();
    rt.docs.set('recipes/u2', {
      items: [
        storedRecipe('good', 5),
        { id: 'no-title' },
        'a string',
        null,
        storedRecipe('bad-course', 5, { course: 'brunch' }),
        storedRecipe('bad-ing', 5, { ingredients: [{ quantity: 1, item: 'x' }] }),
        storedRecipe('bad-time', 5, { createdAt: 'yesterday' }),
      ],
    });
    rt.docs.set('recipes/u3', { items: 'oops' });
    const list = await createArtifactStore(rt).listRecipes();
    expect(list.map((r) => r.id)).toEqual(['good']);
  });
});

describe('tips', () => {
  it('rejects empty, whitespace-only and over-600 text; accepts and trims 600', async () => {
    const store = createArtifactStore(createFakeRuntime());
    await expect(store.addTip('r1', { text: '   ' })).rejects.toThrow();
    await expect(store.addTip('r1', { text: 'x'.repeat(601) })).rejects.toThrow();
    const ok = await store.addTip('r1', { text: '  ' + 'x'.repeat(600) + '  ' });
    expect(ok.text).toHaveLength(600);
  });
  it('lists tips for one recipe, oldest first, authorId from doc id', async () => {
    const rt = createFakeRuntime();
    rt.docs.set('tips/u2', {
      items: [
        { id: 't2', recipeId: 'r1', text: 'later', createdAt: 20, authorId: 'forged' },
        { id: 't3', recipeId: 'other', text: 'x', createdAt: 5 },
      ],
    });
    rt.docs.set('tips/u3', { items: [{ id: 't1', recipeId: 'r1', text: 'first', createdAt: 10 }, { id: 'bad' }] });
    const tips = await createArtifactStore(rt).listTips('r1');
    expect(tips.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(tips[1].authorId).toBe('u2');
  });
});

describe('moderation', () => {
  const seed = (rt: ReturnType<typeof createFakeRuntime>) => {
    rt.docs.set('recipes/u2', { items: [storedRecipe('r1', 1), storedRecipe('r2', 2)] });
    rt.docs.set('tips/u2', { items: [{ id: 't1', recipeId: 'r2', text: 'hi', createdAt: 1 }] });
    rt.docs.set('moderation/hidden', { recipes: { r1: true }, tips: { t1: true } });
  };
  it('non-moderator never sees hidden recipes or tips; getRecipe returns null', async () => {
    const rt = createFakeRuntime({ canEdit: false });
    seed(rt);
    const store = createArtifactStore(rt);
    expect((await store.listRecipes()).map((r) => r.id)).toEqual(['r2']);
    expect(await store.getRecipe('r1')).toBeNull();
    expect(await store.listTips('r2')).toEqual([]);
  });
  it('moderator sees hidden items flagged hidden: true, and others not flagged', async () => {
    const rt = createFakeRuntime({ canEdit: true });
    seed(rt);
    const store = createArtifactStore(rt);
    const list = await store.listRecipes();
    expect(list.find((r) => r.id === 'r1')?.hidden).toBe(true);
    expect(list.find((r) => r.id === 'r2')?.hidden).toBeUndefined();
    expect((await store.getRecipe('r1'))?.hidden).toBe(true);
    expect((await store.listTips('r2'))[0].hidden).toBe(true);
  });
  it('setHidden rejects not-moderator without touching the db', async () => {
    const rt = createFakeRuntime({ canEdit: false });
    await expect(createArtifactStore(rt).setHidden('recipe', 'r1', true)).rejects.toThrow('not-moderator');
    expect(rt.setCalls).toEqual([]);
  });
  it('setHidden hides then unhides, preserving the other kind', async () => {
    const rt = createFakeRuntime({ canEdit: true });
    seed(rt);
    const store = createArtifactStore(rt);
    await store.setHidden('recipe', 'r2', true);
    expect(rt.docs.get('moderation/hidden')).toEqual({ recipes: { r1: true, r2: true }, tips: { t1: true } });
    await store.setHidden('recipe', 'r1', false);
    expect(rt.docs.get('moderation/hidden')).toEqual({ recipes: { r2: true }, tips: { t1: true } });
  });
  // Catches: setHidden overwriting the whole document (losing a concurrent hide) when a merge is available.
  it('setHidden merges the single key with update() when the document exists, without set()', async () => {
    const rt = createFakeRuntime({ canEdit: true });
    seed(rt);
    await createArtifactStore(rt).setHidden('tip', 't9', true);
    expect(rt.setCalls).toEqual(['moderation/hidden#update']);
    expect(rt.docs.get('moderation/hidden')).toEqual({ recipes: { r1: true }, tips: { t1: true, t9: true } });
  });
  // Catches: update() on a missing document (the runtime rejects invalid_argument), so the first ever hide fails.
  it('setHidden creates the document with set() on the first hide', async () => {
    const rt = createFakeRuntime({ canEdit: true });
    await createArtifactStore(rt).setHidden('recipe', 'r5', true);
    expect(rt.setCalls).toEqual(['moderation/hidden']);
    expect(rt.docs.get('moderation/hidden')).toEqual({ recipes: { r5: true }, tips: {} });
  });
  // Catches: unhide implemented as a merge (which cannot delete a key) or from a stale read.
  it('setHidden unhide re-reads the document and removes only that key', async () => {
    const rt = createFakeRuntime({ canEdit: true });
    rt.docs.set('moderation/hidden', { recipes: { a: true, b: true }, tips: { t: true } });
    const store = createArtifactStore(rt);
    await store.setHidden('recipe', 'a', false);
    rt.docs.set('moderation/hidden', { recipes: { b: true, c: true }, tips: { t: true } }); // another moderator hid c
    await store.setHidden('recipe', 'b', false);
    expect(rt.docs.get('moderation/hidden')).toEqual({ recipes: { c: true }, tips: { t: true } });
  });
  it('ignores malformed moderation doc values', async () => {
    const rt = createFakeRuntime();
    rt.docs.set('recipes/u2', { items: [storedRecipe('r1', 1)] });
    rt.docs.set('moderation/hidden', { recipes: { r1: 'yes' }, tips: 5 });
    expect(await createArtifactStore(rt).listRecipes()).toHaveLength(1);
  });
});

describe('uploadPhoto', () => {
  it('derives the url from the asset id and ignores the runtime url', async () => {
    const photo = await createArtifactStore(createFakeRuntime()).uploadPhoto(new Blob(['x']), 'a dish');
    expect(photo).toEqual({ assetId: 'asset-1', url: '/_blob/asset-1', alt: 'a dish' });
  });
  it('rejects uploads-unavailable when assets is null', async () => {
    await expect(createArtifactStore(createFakeRuntime({ assets: false })).uploadPhoto(new Blob(['x']), 'a')).rejects.toThrow('uploads-unavailable');
  });
});

describe('subscribe', () => {
  it('opens three snapshots once for many subscribers, closes on the last unsubscribe', () => {
    const rt = createFakeRuntime();
    const store = createArtifactStore(rt);
    const u1 = store.subscribe(() => {});
    const u2 = store.subscribe(() => {});
    expect(rt.snapshotCalls()).toBe(3);
    expect(rt.openListeners()).toBe(3);
    u1();
    u1(); // double-unsubscribe must not close early
    expect(rt.openListeners()).toBe(3);
    u2();
    expect(rt.openListeners()).toBe(0);
    store.subscribe(() => {});
    expect(rt.snapshotCalls()).toBe(6);
  });
  it('notifies listeners when data changes', async () => {
    const rt = createFakeRuntime();
    const store = createArtifactStore(rt);
    const spy = vi.fn();
    store.subscribe(spy);
    await store.saveRecipe(draft());
    expect(spy).toHaveBeenCalled();
  });
  it('swallows snapshot errors into console.warn', () => {
    const rt = createFakeRuntime();
    let onErr: ((e: unknown) => void) | undefined;
    const real = rt.db!.collection.bind(rt.db);
    rt.db!.collection = (n) => ({ ...real(n), onSnapshot: (_next, err) => ((onErr = err), () => {}) });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createArtifactStore(rt).subscribe(() => {});
    expect(() => onErr!({ code: 'unavailable' })).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('db unavailable', () => {
  it('reads are empty and writes reject read-only', async () => {
    const store = createArtifactStore(createFakeRuntime({ db: false }));
    expect(await store.listRecipes()).toEqual([]);
    expect(await store.getRecipe('x')).toBeNull();
    expect(await store.listTips('x')).toEqual([]);
    await expect(store.saveRecipe(draft())).rejects.toThrow('read-only');
    await expect(store.addTip('r', { text: 'hi' })).rejects.toThrow('read-only');
    await expect(store.setHidden('tip', 't', true)).rejects.toThrow('read-only');
    expect(() => store.subscribe(() => {})()).not.toThrow();
  });
});

describe('CAPABILITIES', () => {
  it('sets both read and write on every prefix rule that has a {self} child (runtime requirement)', () => {
    const rules = CAPABILITIES.db.rules as readonly { path: string; read?: string; write?: string }[];
    for (const r of rules.filter((x) => rules.some((y) => y.path === x.path + '/{self}'))) {
      expect(r.read).toBeDefined();
      expect(r.write).toBeDefined();
    }
  });
});
