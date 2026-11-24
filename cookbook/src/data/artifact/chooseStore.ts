import { createMockStore } from '../mock/mockStore';
import type { DataStore } from '../store';
import { createArtifactStore } from './artifactStore';
import type { ArtifactRuntime } from './runtime';

interface ClaudeGlobal {
  use?: (name: string) => Promise<unknown>;
}

/**
 * artifact: the claude.ai runtime answered; mock: not inside claude.ai (file://, dev);
 * offline: inside claude.ai but the runtime did not come up (read-only, nothing shown as writable).
 */
export type StoreStatus = 'artifact' | 'mock' | 'offline';

export const OFFLINE_NOTICE = "Couldn't reach the cookbook's shared storage. Reload to try again.";

/** A store with empty reads whose me() reports no write and no moderation; every write rejects read-only. */
function offlineStore(): DataStore {
  return createArtifactStore({
    db: null,
    assets: null,
    user: {
      id: async () => null,
      canEdit: async () => false,
      can: async () => false,
      profiles: async () => ({}),
    },
  });
}

/** Picks the artifact-backed store when the claude.ai runtime answers, else the local mock. Never throws. */
export async function chooseStore(opts: { timeoutMs?: number } = {}): Promise<{ store: DataStore; status: StoreStatus }> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const mock = () => ({ store: createMockStore({ persist: true }), status: 'mock' as const });
  const offline = () => ({ store: offlineStore(), status: 'offline' as const });

  const claude = (globalThis as { claude?: ClaudeGlobal }).claude;
  if (!claude || typeof claude.use !== 'function') return mock();

  // From here on we are inside claude.ai: never fall back to a writable per-browser mock.
  try {
    const use = claude.use.bind(claude);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const all = Promise.all([use('db'), use('assets'), use('user')]);
    // If the timeout wins, `all` may reject later: attach a handler so that is never an unhandled rejection.
    all.catch(() => {});
    const got = await Promise.race([all, timeout]);
    clearTimeout(timer);
    if (!got) return offline();
    const [db, assets, user] = got;
    if (!user) return offline();
    return { store: createArtifactStore({ db, assets, user } as ArtifactRuntime), status: 'artifact' };
  } catch (e) {
    console.warn('chooseStore failed, shared storage unavailable', e);
    return offline();
  }
}
