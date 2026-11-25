import type { Course, DietaryTag, Recipe } from '../../domain/types';

export interface BrowseFilters {
  dietary: DietaryTag[];
  courses: Course[];
  origins: string[];
  occasions: string[];
  authorId?: string;
  text: string;
}

export const EMPTY_FILTERS: BrowseFilters = { dietary: [], courses: [], origins: [], occasions: [], text: '' };

/** Number of individually clearable filters currently set. */
export function activeCount(f: BrowseFilters): number {
  return (
    f.dietary.length + f.courses.length + f.origins.length + f.occasions.length +
    (f.authorId ? 1 : 0) + (f.text.trim() ? 1 : 0)
  );
}

/** Lower-case and strip accents ("Cr\u00e8me" -> "creme") so typing without accents still finds the card. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Every word typed must appear somewhere in the card's searchable text: title, origin, occasions, story,
 * the author's display name, each ingredient item and each step. Ingredient quantities are not searched.
 */
function matchesText(r: Recipe, text: string, authorName: string): boolean {
  const words = fold(text).split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return true;
  const hay = fold(
    [r.title, r.origin, ...r.occasions, r.story, authorName, ...r.ingredients.map((i) => i.item), ...r.steps.map((s) => s.text)].join('\n'),
  );
  return words.every((w) => hay.includes(w));
}

/** `names` maps author id to display name so the search can match people. OR inside courses/origins/occasions, AND across groups, dietary needs every selected tag. */
export function applyFilters(recipes: Recipe[], f: BrowseFilters, names: Record<string, string> = {}): Recipe[] {
  return recipes.filter(
    (r) =>
      f.dietary.every((d) => r.dietary.includes(d)) &&
      (f.courses.length === 0 || f.courses.includes(r.course)) &&
      (f.origins.length === 0 || f.origins.includes(r.origin)) &&
      (f.occasions.length === 0 || r.occasions.some((o) => f.occasions.includes(o))) &&
      (!f.authorId || r.authorId === f.authorId) &&
      matchesText(r, f.text, names[r.authorId] ?? ''),
  );
}

export function distinctSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => v.length > 0))).sort((a, b) => a.localeCompare(b));
}
