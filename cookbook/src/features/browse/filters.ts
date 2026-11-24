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

function matchesText(r: Recipe, text: string): boolean {
  const needle = text.trim().toLowerCase();
  if (!needle) return true;
  return [r.title, r.origin, ...r.occasions, r.story].some((s) => s.toLowerCase().includes(needle));
}

/** OR inside courses/origins/occasions, AND across groups, dietary needs every selected tag. */
export function applyFilters(recipes: Recipe[], f: BrowseFilters): Recipe[] {
  return recipes.filter(
    (r) =>
      f.dietary.every((d) => r.dietary.includes(d)) &&
      (f.courses.length === 0 || f.courses.includes(r.course)) &&
      (f.origins.length === 0 || f.origins.includes(r.origin)) &&
      (f.occasions.length === 0 || r.occasions.some((o) => f.occasions.includes(o))) &&
      (!f.authorId || r.authorId === f.authorId) &&
      matchesText(r, f.text),
  );
}

export function distinctSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => v.length > 0))).sort((a, b) => a.localeCompare(b));
}
