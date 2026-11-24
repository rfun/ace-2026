import type { Me, Person, Photo, Recipe, RecipeDraft, Tip, UserId } from '../../domain/types';
import type { DataStore } from '../store';
import { parseHidden, parseRecipe, parseTip, toStoredPhoto, type Hidden } from './parse';
import type { ArtifactRuntime, DbLike } from './runtime';

const MAX_DOC_BYTES = 240 * 1024;
const MAX_TIP_CHARS = 600;
const HIDDEN_PATH = 'moderation/hidden';

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const rawItems = (data: Raw | undefined): unknown[] => (data && Array.isArray(data.items) ? data.items : []);

function assertFits(items: unknown[]): void {
  if (new TextEncoder().encode(JSON.stringify({ items })).length >= MAX_DOC_BYTES) throw new Error('too-large');
}

/** Drop undefined fields and keep only JSON-safe data. */
const jsonClean = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function storedRecipe(r: Omit<Recipe, 'authorId' | 'hidden' | 'sample'>): Raw {
  const photoOf = (p: Photo | undefined) => toStoredPhoto(p);
  return jsonClean({
    ...r,
    mainPhoto: photoOf(r.mainPhoto),
    steps: r.steps.map((s) => ({ ...s, photo: photoOf(s.photo) })),
  });
}

export function createArtifactStore(rt: ArtifactRuntime): DataStore {
  const { db, assets, user } = rt;

  let mePromise: Promise<Me> | null = null;
  const loadMe = (): Promise<Me> =>
    (mePromise ??= (async () => {
      const id = (await user.id()) ?? '';
      const canModerate = await user.canEdit();
      const canWrite = db !== null && id !== '' && (await user.can('data.write')) !== false;
      return { id, canWrite, canModerate };
    })());

  async function readHidden(d: DbLike): Promise<Hidden> {
    const snap = await d.doc(HIDDEN_PATH).get();
    return parseHidden(snap.exists ? snap.data() : undefined);
  }

  async function allRecipes(): Promise<Recipe[]> {
    if (!db) return [];
    const [me, snap, hidden] = await Promise.all([loadMe(), db.collection('recipes').get(), readHidden(db)]);
    const out: Recipe[] = [];
    for (const doc of snap.docs) {
      for (const item of rawItems(doc.data())) {
        const r = parseRecipe(item, doc.id);
        if (!r) continue;
        if (hidden.recipes[r.id]) {
          if (!me.canModerate) continue;
          r.hidden = true;
        }
        out.push(r);
      }
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }

  async function requireWriter(): Promise<{ d: DbLike; id: UserId }> {
    if (!db) throw new Error('read-only');
    const me = await loadMe();
    if (me.id === '') throw new Error('not-signed-in');
    return { d: db, id: me.id };
  }

  const listeners = new Set<() => void>();
  let closers: Array<() => void> = [];
  const notify = () => listeners.forEach((l) => l());
  const onErr = (e: unknown) => console.warn('artifact snapshot error', e);
  function openSnapshots() {
    if (!db) return;
    try {
      closers = [
        db.collection('recipes').onSnapshot(notify, onErr),
        db.collection('tips').onSnapshot(notify, onErr),
        db.doc(HIDDEN_PATH).onSnapshot(notify, onErr),
      ];
    } catch (e) {
      console.warn('artifact snapshot setup failed', e);
    }
  }

  return {
    me: loadMe,

    async people(ids: UserId[]): Promise<Record<UserId, Person>> {
      const out: Record<UserId, Person> = {};
      if (ids.length === 0) return out;
      const profiles = await user.profiles(ids);
      for (const id of ids) {
        const name = profiles[id]?.name;
        out[id] = { id, name: typeof name === 'string' && name.trim() !== '' ? name : 'Someone' };
      }
      return out;
    },

    listRecipes: allRecipes,

    async getRecipe(id: string): Promise<Recipe | null> {
      return (await allRecipes()).find((r) => r.id === id) ?? null;
    },

    async saveRecipe(draft: RecipeDraft & { id?: string }): Promise<Recipe> {
      const { d, id: me } = await requireWriter();
      const { id: draftId, hidden: _hidden, sample: _sample, ...fields } = draft;
      const ref = d.doc(`recipes/${me}`);
      const snap = await ref.get();
      const items = [...rawItems(snap.exists ? snap.data() : undefined)];
      const now = Date.now();

      let recipe: Recipe;
      if (draftId === undefined) {
        recipe = { ...fields, id: crypto.randomUUID(), authorId: me, createdAt: now, updatedAt: now };
        items.push(storedRecipe(recipe));
      } else {
        const idx = items.findIndex((i) => isObj(i) && i.id === draftId);
        if (idx < 0) {
          const others = await d.collection('recipes').get();
          const elsewhere = others.docs.some((doc) => doc.id !== me && rawItems(doc.data()).some((i) => isObj(i) && i.id === draftId));
          throw new Error(elsewhere ? 'not-author' : 'not-found');
        }
        const existing = parseRecipe(items[idx], me);
        recipe = { ...fields, id: draftId, authorId: me, createdAt: existing?.createdAt ?? now, updatedAt: now };
        items[idx] = storedRecipe(recipe);
      }
      assertFits(items);
      await ref.set({ items });
      return recipe;
    },

    async listTips(recipeId: string): Promise<Tip[]> {
      if (!db) return [];
      const [me, snap, hidden] = await Promise.all([loadMe(), db.collection('tips').get(), readHidden(db)]);
      const out: Tip[] = [];
      for (const doc of snap.docs) {
        for (const item of rawItems(doc.data())) {
          const t = parseTip(item, doc.id);
          if (!t || t.recipeId !== recipeId) continue;
          if (hidden.tips[t.id]) {
            if (!me.canModerate) continue;
            t.hidden = true;
          }
          out.push(t);
        }
      }
      return out.sort((a, b) => a.createdAt - b.createdAt);
    },

    async addTip(recipeId: string, tip: { text: string; photo?: Photo }): Promise<Tip> {
      const text = typeof tip.text === 'string' ? tip.text.trim() : '';
      if (text.length < 1 || text.length > MAX_TIP_CHARS) throw new Error('invalid-tip');
      const { d, id: me } = await requireWriter();
      const ref = d.doc(`tips/${me}`);
      const snap = await ref.get();
      const items = [...rawItems(snap.exists ? snap.data() : undefined)];
      const created: Tip = { id: crypto.randomUUID(), recipeId, authorId: me, text, createdAt: Date.now() };
      if (tip.photo) created.photo = tip.photo;
      items.push(jsonClean({ id: created.id, recipeId, text, createdAt: created.createdAt, photo: toStoredPhoto(tip.photo) }));
      assertFits(items);
      await ref.set({ items });
      return created;
    },

    async setHidden(kind: 'recipe' | 'tip', id: string, hidden: boolean): Promise<void> {
      if (!db) throw new Error('read-only');
      const me = await loadMe();
      if (!me.canModerate) throw new Error('not-moderator');
      const current = await readHidden(db);
      const key = kind === 'recipe' ? 'recipes' : 'tips';
      if (hidden) current[key][id] = true;
      else delete current[key][id];
      await db.doc(HIDDEN_PATH).set({ recipes: current.recipes, tips: current.tips });
    },

    async uploadPhoto(file: Blob, alt: string): Promise<Photo> {
      if (!assets) throw new Error('uploads-unavailable');
      const res = await assets.upload(file);
      return { assetId: res.id, url: '/_blob/' + res.id, alt };
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      if (listeners.size === 1) openSnapshots();
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        listeners.delete(listener);
        if (listeners.size === 0) {
          closers.forEach((c) => c());
          closers = [];
        }
      };
    },
  };
}
