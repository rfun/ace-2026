import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-ignore node types are not installed for the browser build; this runs under vitest only.
import process from 'node:process';
import { chooseStore } from './chooseStore';
import { createFakeRuntime } from './fakeRuntime';

type W = { claude?: unknown };
afterEach(() => {
  delete (globalThis as W).claude;
  vi.useRealTimers();
  localStorage.clear();
});

// The mock store returns sample data (sample: true); the artifact store over an empty db returns none.
const isMock = async (r: Awaited<ReturnType<typeof chooseStore>>) => (await r.store.listRecipes()).length > 0;
const expectOffline = async (r: Awaited<ReturnType<typeof chooseStore>>) => {
  expect(r.status).toBe('offline');
  expect(await r.store.listRecipes()).toEqual([]);
  expect(await r.store.me()).toEqual({ id: '', canWrite: false, canModerate: false });
  await expect(r.store.saveRecipe({} as never)).rejects.toThrow();
};

describe('chooseStore', () => {
  // Catches: dev/file:// users losing the working mock, or getting a notice.
  it('uses the mock store with status mock when window.claude is absent', async () => {
    const r = await chooseStore();
    expect(r.status).toBe('mock');
    expect(await isMock(r)).toBe(true);
  });
  // Catches: a writable per-browser mock inside claude.ai when the user capability is unavailable.
  it('goes offline (read-only, empty) when the user capability resolves null', async () => {
    (globalThis as W).claude = { use: async (n: string) => (n === 'user' ? null : {}) };
    await expectOffline(await chooseStore());
  });
  // Catches: a hung runtime blocking the app forever, or falling back to a writable mock.
  it('goes offline when use() never answers (timeout)', async () => {
    vi.useFakeTimers();
    (globalThis as W).claude = { use: () => new Promise(() => {}) };
    const p = chooseStore({ timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(60);
    await expectOffline(await p);
  });
  // Catches: throwing out of chooseStore, or a writable mock fallback, when use() rejects.
  it('goes offline instead of throwing when use() rejects', async () => {
    (globalThis as W).claude = { use: async () => Promise.reject(new Error('boom')) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expectOffline(await chooseStore());
    warn.mockRestore();
  });
  // Catches: the raced promise rejecting after the timeout won, surfacing an unhandledRejection.
  it('leaves no unhandled rejection when use() rejects after the timeout', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    try {
      (globalThis as W).claude = { use: () => new Promise((_, reject) => setTimeout(() => reject(new Error('late')), 40)) };
      await expectOffline(await chooseStore({ timeoutMs: 10 }));
      await new Promise((r) => setTimeout(r, 120));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
  // Catches: the artifact path regressing when the db capability alone is missing.
  it('returns the artifact store when user resolves, even if db is null', async () => {
    const rt = createFakeRuntime();
    (globalThis as W).claude = { use: async (n: string) => (n === 'db' ? null : n === 'user' ? rt.user : rt.assets) };
    const { store, status } = await chooseStore();
    expect(status).toBe('artifact');
    expect(await store.listRecipes()).toEqual([]);
    expect((await store.me()).canWrite).toBe(false);
  });
});
