import { createMockStore } from '../mock/mockStore';
import type { DataStore } from '../store';
import { createArtifactStore } from './artifactStore';
import type { ArtifactRuntime } from './runtime';

interface ClaudeGlobal {
  use?: (name: string) => Promise<unknown>;
}

/** Picks the artifact-backed store when the claude.ai runtime answers, else the local mock. Never throws. */
export async function chooseStore(opts: { timeoutMs?: number } = {}): Promise<DataStore> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const fallback = () => createMockStore({ persist: true });
  try {
    const claude = (globalThis as { claude?: ClaudeGlobal }).claude;
    if (!claude || typeof claude.use !== 'function') return fallback();
    const use = claude.use.bind(claude);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const all = Promise.all([use('db'), use('assets'), use('user')]);
    const got = await Promise.race([all, timeout]);
    clearTimeout(timer);
    if (!got) return fallback();
    const [db, assets, user] = got;
    if (!user) return fallback();
    return createArtifactStore({ db, assets, user } as ArtifactRuntime);
  } catch (e) {
    console.warn('chooseStore failed, using local store', e);
    return fallback();
  }
}
