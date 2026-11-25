import type { Course, DietaryTag, Recipe, RecipeStats, Shelf } from '../../domain/types';

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** My shelf choices: want = on my want-to-make list, made = on my made list, untried = on neither. */
export type ShelfFilter = 'want' | 'made' | 'untried';
export type SortMode = 'newest' | 'most-made';

/** What the viewer's own state adds to filtering. Everything is passed in so tests are deterministic. */
export interface FilterContext {
  meId?: string;
  /** Absent when the shelf could not be loaded: the shelf filter is then ignored. */
  shelf?: Shelf;
  /** Recipe ids the viewer wrote a made note on, when known; they count as tried. */
  madeNoteIds?: ReadonlySet<string>;
  now?: number;
}

export interface BrowseFilters {
  dietary: DietaryTag[];
  courses: Course[];
  origins: string[];
  occasions: string[];
  /** Keywords (Recipe.tags): a recipe matches when it has any selected one. */
  tags: string[];
  authorId?: string;
  shelf?: ShelfFilter;
  /** Only recipes I contributed. */
  mine: boolean;
  /** Only recipes added in the last 7 days. */
  fresh: boolean;
  text: string;
}

export const EMPTY_FILTERS: BrowseFilters = { dietary: [], courses: [], origins: [], occasions: [], tags: [], mine: false, fresh: false, text: '' };

/** Number of individually clearable filters currently set. */
export function activeCount(f: BrowseFilters): number {
  return (
    f.dietary.length + f.courses.length + f.origins.length + f.occasions.length + f.tags.length +
    (f.authorId ? 1 : 0) + (f.shelf ? 1 : 0) + (f.mine ? 1 : 0) + (f.fresh ? 1 : 0) + (f.text.trim() ? 1 : 0)
  );
}

/** Lower-case and strip accents ("Cr\u00e8me" -> "creme") so typing without accents still finds the card. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Every word typed must appear somewhere in the card's searchable text: title, origin, occasions, keywords, story,
 * the author's display name, each ingredient item and each step. Ingredient quantities are not searched.
 */
function matchesText(r: Recipe, text: string, authorName: string): boolean {
  const words = fold(text).split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return true;
  const hay = fold(
    [r.title, r.origin, ...r.occasions, ...(r.tags ?? []), r.story, authorName, ...r.ingredients.map((i) => i.item), ...r.steps.map((s) => s.text)].join('\n'),
  );
  return words.every((w) => hay.includes(w));
}

/** Added within the last 7 days (exactly 7 days old still counts; a future timestamp from clock skew counts too). */
export function isNew(r: Recipe, now: number): boolean {
  return now - r.createdAt <= WEEK_MS;
}

function matchesShelf(id: string, choice: ShelfFilter | undefined, ctx: FilterContext): boolean {
  if (!choice || !ctx.shelf) return true;
  const want = ctx.shelf.want.includes(id);
  const made = ctx.shelf.made.includes(id) || (ctx.madeNoteIds?.has(id) ?? false);
  if (choice === 'want') return want;
  if (choice === 'made') return made;
  return !want && !made;
}

/** Newest first, or most made first: madeBy desc, then wantCount desc, then newest. A recipe with no stats entry counts as 0 and 0. */
export function sortRecipes(recipes: Recipe[], mode: SortMode, stats: Record<string, RecipeStats> = {}): Recipe[] {
  const out = [...recipes];
  if (mode === 'newest') return out.sort((a, b) => b.createdAt - a.createdAt);
  const m = (r: Recipe) => stats[r.id]?.madeBy ?? 0;
  const w = (r: Recipe) => stats[r.id]?.wantCount ?? 0;
  return out.sort((a, b) => m(b) - m(a) || w(b) - w(a) || b.createdAt - a.createdAt);
}

/** `names` maps author id to display name so the search can match people. OR inside courses/origins/occasions/keywords, AND across groups, dietary needs every selected tag. */
export function applyFilters(recipes: Recipe[], f: BrowseFilters, names: Record<string, string> = {}, ctx: FilterContext = {}): Recipe[] {
  const now = ctx.now ?? Date.now();
  return recipes.filter(
    (r) =>
      f.dietary.every((d) => r.dietary.includes(d)) &&
      (f.courses.length === 0 || f.courses.includes(r.course)) &&
      (f.origins.length === 0 || f.origins.includes(r.origin)) &&
      (f.occasions.length === 0 || r.occasions.some((o) => f.occasions.includes(o))) &&
      (f.tags.length === 0 || (r.tags ?? []).some((t) => f.tags.includes(t))) &&
      (!f.authorId || r.authorId === f.authorId) &&
      matchesShelf(r.id, f.shelf, ctx) &&
      (!f.mine || r.authorId === ctx.meId) &&
      (!f.fresh || isNew(r, now)) &&
      matchesText(r, f.text, names[r.authorId] ?? ''),
  );
}

export function distinctSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => v.length > 0))).sort((a, b) => a.localeCompare(b));
}
