import type { ArtifactRuntime, DbDocRef, DbLike, DbQuerySnapshot, DbSnapshotDoc } from './runtime';

// In-memory, rule-free stand-in for the artifact runtime (tests only).

export interface FakeRuntime extends ArtifactRuntime {
  docs: Map<string, Record<string, unknown>>;
  /** Number of currently open snapshot listeners. */
  openListeners(): number;
  /** Total onSnapshot calls ever made. */
  snapshotCalls(): number;
  setCalls: string[];
  uploads: Blob[];
}

export interface FakeOptions {
  userId?: string | null;
  canEdit?: boolean;
  canWrite?: boolean | null;
  db?: boolean;
  assets?: boolean;
  names?: Record<string, string>;
}

// Mirrors the runtime's `update`: nested objects merge recursively, anything else replaces.
function mergeDeep(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  for (const [k, v] of Object.entries(patch)) {
    const b = base[k];
    const plain = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
    base[k] = plain(v) && plain(b) ? mergeDeep(b, v) : v;
  }
  return base;
}

export function createFakeRuntime(opts: FakeOptions = {}): FakeRuntime {
  const docs = new Map<string, Record<string, unknown>>();
  const subs = new Set<() => void>();
  let calls = 0;
  const setCalls: string[] = [];
  const uploads: Blob[] = [];
  const fire = () => [...subs].forEach((s) => s());

  const snapOf = (path: string): DbSnapshotDoc => {
    const data = docs.get(path);
    return { id: path.split('/').pop() as string, exists: data !== undefined, data: () => (data ? structuredClone(data) : undefined) };
  };
  const collSnap = (name: string): DbQuerySnapshot => ({
    docs: [...docs.keys()].filter((k) => k.startsWith(name + '/') && k.split('/').length === 2).map(snapOf),
  });
  const listen = (cb: () => void) => {
    calls++;
    subs.add(cb);
    return () => void subs.delete(cb);
  };

  const db: DbLike = {
    doc(path): DbDocRef {
      return {
        get: async () => snapOf(path),
        set: async (data) => {
          setCalls.push(path);
          docs.set(path, structuredClone(data));
          fire();
        },
        update: async (data) => {
          const cur = docs.get(path);
          if (!cur) throw new Error('invalid_argument');
          setCalls.push(path + '#update');
          docs.set(path, mergeDeep(structuredClone(cur), structuredClone(data)));
          fire();
        },
        onSnapshot: (next) => listen(() => next(snapOf(path))),
      };
    },
    collection(name) {
      return { get: async () => collSnap(name), onSnapshot: (next) => listen(() => next(collSnap(name))) };
    },
  };

  const names = opts.names ?? {};
  return {
    docs,
    setCalls,
    uploads,
    openListeners: () => subs.size,
    snapshotCalls: () => calls,
    db: opts.db === false ? null : db,
    assets:
      opts.assets === false
        ? null
        : {
            upload: async (blob) => {
              uploads.push(blob);
              return { id: `asset-${uploads.length}`, url: 'https://ignored.example/should-not-be-used' };
            },
          },
    user: {
      id: async () => (opts.userId === undefined ? 'u1' : opts.userId),
      canEdit: async () => opts.canEdit ?? false,
      can: async () => (opts.canWrite === undefined ? true : opts.canWrite),
      profiles: async (ids) => Object.fromEntries(ids.map((id) => [id, { id, name: names[id] ?? '' }])),
    },
  };
}
