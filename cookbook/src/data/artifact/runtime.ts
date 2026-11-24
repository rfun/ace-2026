// Minimal local views of the claude.ai artifact runtime namespaces we use.
// Signatures copied from the runtime contract; the contract files themselves
// are not part of the build.

export interface DbSnapshotDoc {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
export interface DbQuerySnapshot {
  docs: DbSnapshotDoc[];
}
export interface DbDocRef {
  get(): Promise<DbSnapshotDoc>;
  set(data: Record<string, unknown>): Promise<void>;
  /** Merge-write; nested objects merge recursively, arrays replace. Rejects if the document does not exist. */
  update(data: Record<string, unknown>): Promise<void>;
  onSnapshot(next: (snap: DbSnapshotDoc) => void, error?: (e: unknown) => void): () => void;
}
export interface DbCollectionRef {
  get(): Promise<DbQuerySnapshot>;
  onSnapshot(next: (snap: DbQuerySnapshot) => void, error?: (e: unknown) => void): () => void;
}
export interface DbLike {
  doc(path: string): DbDocRef;
  collection(path: string): DbCollectionRef;
}

export interface AssetsLike {
  upload(blob: Blob): Promise<{ id: string; url: string }>;
}

export interface ProfileLike {
  id: string;
  name: string;
}
export interface UserLike {
  id(): Promise<string | null>;
  canEdit(): Promise<boolean>;
  can(capability: string): Promise<boolean | null>;
  profiles(ids: readonly string[]): Promise<Record<string, ProfileLike>>;
}

export interface ArtifactRuntime {
  db: DbLike | null;
  assets: AssetsLike | null;
  user: UserLike;
}

/**
 * Capabilities the published page declares (used by the publish step).
 *
 * Moderation note: hiding is display-level only. Hidden items stay readable
 * through the db API by any signed-in member (rules give everyone `view` read);
 * the app just filters them out for non-moderators. Removal by an editor is
 * possible because editors hold the `admin` write level, which meets the
 * `admin` write rule on the `recipes` and `tips` prefixes.
 */
export const CAPABILITIES = {
  db: {
    rules: [
      { path: 'recipes', read: 'view', write: 'admin' },
      { path: 'recipes/{self}', read: 'view', write: 'interact' },
      { path: 'tips', read: 'view', write: 'admin' },
      { path: 'tips/{self}', read: 'view', write: 'interact' },
      { path: 'moderation', read: 'view', write: 'admin' },
    ],
  },
  assets: { upload: 'interact' },
  user: { scopes: ['profile'] },
} as const;
