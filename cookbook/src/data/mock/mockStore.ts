import type { DataStore } from '../store';
import type { Me, Person, Photo, Recipe, RecipeDraft, Tip, UserId } from '../../domain/types';
import { SAMPLE_PEOPLE, SAMPLE_RECIPES, SAMPLE_TIPS } from './samples';

export interface MockStoreOptions {
  me?: Me;
  people?: Person[];
  recipes?: Recipe[];
  tips?: Tip[];
  persist?: boolean;
}

const STORAGE_KEY = 'ace-culture-cookbook:mock-store:v1';

interface State {
  recipes: Recipe[];
  tips: Tip[];
  counter: number;
}

function loadState(): State | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as State) : null;
  } catch {
    return null;
  }
}

function saveState(state: State): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable or full: keep working in memory
  }
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

export function createMockStore(opts: MockStoreOptions = {}): DataStore {
  const me: Me = opts.me ?? { id: 'u-you', canWrite: true, canModerate: false };
  const people = opts.people ?? SAMPLE_PEOPLE;
  const persisted = opts.persist ? loadState() : null;
  const state: State = persisted ?? {
    recipes: structuredClone(opts.recipes ?? SAMPLE_RECIPES),
    tips: structuredClone(opts.tips ?? SAMPLE_TIPS),
    counter: 0,
  };
  const listeners = new Set<() => void>();
  let photoCounter = 0;

  function commit(): void {
    if (opts.persist) saveState(state);
    listeners.forEach((l) => l());
  }

  function nextId(prefix: string): string {
    state.counter += 1;
    return `${prefix}-${Date.now().toString(36)}-${state.counter}`;
  }

  const visibleRecipe = (r: Recipe) => me.canModerate || !r.hidden;

  return {
    async me() {
      return { ...me };
    },

    async people(ids: UserId[]) {
      const out: Record<UserId, Person> = {};
      for (const p of people) if (ids.includes(p.id)) out[p.id] = { ...p };
      return out;
    },

    async listRecipes() {
      return structuredClone(state.recipes.filter(visibleRecipe));
    },

    async getRecipe(id: string) {
      const r = state.recipes.find((x) => x.id === id);
      return r ? structuredClone(r) : null;
    },

    async saveRecipe(draft: RecipeDraft & { id?: string }) {
      const { id, ...fields } = draft;
      const now = Date.now();
      if (id === undefined) {
        const created: Recipe = { ...fields, id: nextId('r'), authorId: me.id, createdAt: now, updatedAt: now };
        state.recipes.push(created);
        commit();
        return structuredClone(created);
      }
      const idx = state.recipes.findIndex((x) => x.id === id);
      if (idx === -1) throw new Error('not found');
      const existing = state.recipes[idx];
      if (existing.authorId !== me.id && !me.canModerate) throw new Error('forbidden');
      const updated: Recipe = {
        ...fields,
        id: existing.id,
        authorId: existing.authorId,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
      state.recipes[idx] = updated;
      commit();
      return structuredClone(updated);
    },

    async listTips(recipeId: string) {
      return structuredClone(
        state.tips
          .filter((t) => t.recipeId === recipeId && (me.canModerate || !t.hidden))
          .sort((a, b) => a.createdAt - b.createdAt),
      );
    },

    async addTip(recipeId: string, tip: { text: string; photo?: Photo }) {
      const created: Tip = {
        id: nextId('t'),
        recipeId,
        authorId: me.id,
        text: tip.text,
        ...(tip.photo ? { photo: tip.photo } : {}),
        createdAt: Date.now(),
      };
      state.tips.push(created);
      commit();
      return structuredClone(created);
    },

    async setHidden(kind: 'recipe' | 'tip', id: string, hidden: boolean) {
      if (!me.canModerate) throw new Error('forbidden');
      const list: { id: string; hidden?: boolean }[] = kind === 'recipe' ? state.recipes : state.tips;
      const item = list.find((x) => x.id === id);
      if (!item) throw new Error('not found');
      item.hidden = hidden;
      commit();
    },

    async uploadPhoto(file: Blob, alt: string): Promise<Photo> {
      photoCounter += 1;
      const assetId = `local-${photoCounter}`;
      const url =
        typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(file)
          : await readAsDataUrl(file);
      return { assetId, url, alt };
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
