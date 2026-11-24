import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseStore } from './chooseStore';
import { createFakeRuntime } from './fakeRuntime';

type W = { claude?: unknown };
afterEach(() => {
  delete (globalThis as W).claude;
  vi.useRealTimers();
  localStorage.clear();
});

// The mock store returns sample data (sample: true); the artifact store over an empty db returns none.
const isMock = async (s: Awaited<ReturnType<typeof chooseStore>>) => (await s.listRecipes()).length > 0;

describe('chooseStore', () => {
  it('falls back to the mock store when window.claude is absent', async () => {
    expect(await isMock(await chooseStore())).toBe(true);
  });
  it('falls back when the user capability resolves null', async () => {
    (globalThis as W).claude = { use: async (n: string) => (n === 'user' ? null : {}) };
    expect(await isMock(await chooseStore())).toBe(true);
  });
  it('falls back when use() never answers (timeout)', async () => {
    vi.useFakeTimers();
    (globalThis as W).claude = { use: () => new Promise(() => {}) };
    const p = chooseStore({ timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(60);
    expect(await isMock(await p)).toBe(true);
  });
  it('falls back instead of throwing when use() rejects', async () => {
    (globalThis as W).claude = { use: async () => Promise.reject(new Error('boom')) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await isMock(await chooseStore())).toBe(true);
    warn.mockRestore();
  });
  it('returns the artifact store when user resolves, even if db is null', async () => {
    const rt = createFakeRuntime();
    (globalThis as W).claude = { use: async (n: string) => (n === 'db' ? null : n === 'user' ? rt.user : rt.assets) };
    const store = await chooseStore();
    expect(await store.listRecipes()).toEqual([]);
    expect((await store.me()).canWrite).toBe(false);
  });
});
