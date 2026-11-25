import type { RecipeStats, Shelf, ShelfState } from '../../domain/types';

export const NO_STATS: RecipeStats = { madeBy: 0, wantCount: 0 };

/** Where one recipe sits on a person's shelf. Made wins if a malformed doc lists it twice. */
export function shelfStateOf(shelf: Shelf, recipeId: string): ShelfState {
  if (shelf.made.includes(recipeId)) return 'made';
  if (shelf.want.includes(recipeId)) return 'want';
  return 'none';
}

/** The quiet count line: "Made by 4 · 6 want to make". A zero part is left out; both zero gives ''. */
export function countLine(stats: RecipeStats): string {
  const parts: string[] = [];
  if (stats.madeBy > 0) parts.push(`Made by ${stats.madeBy}`);
  if (stats.wantCount > 0) parts.push(`${stats.wantCount} want to make`);
  return parts.join(' · ');
}

/** The counts after this person moves from one shelf state to another (never below zero). */
export function adjustStats(stats: RecipeStats, from: ShelfState, to: ShelfState): RecipeStats {
  if (from === to) return stats;
  let { madeBy, wantCount } = stats;
  if (from === 'made') madeBy -= 1;
  if (from === 'want') wantCount -= 1;
  if (to === 'made') madeBy += 1;
  if (to === 'want') wantCount += 1;
  return { madeBy: Math.max(0, madeBy), wantCount: Math.max(0, wantCount) };
}
