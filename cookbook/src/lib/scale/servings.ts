/**
 * Servings handoff between the recipe card and kitchen mode. The chosen number lives in sessionStorage, keyed by
 * recipe id, so both screens show the same amounts for the same visit without touching the router. It is never
 * written to the recipe: scaling is a view, not data.
 */

export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 100;

const key = (recipeId: string): string => `cookbook.servings.${recipeId}`;

export const clampServings = (n: number): number => Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(n)));

/** The servings chosen for this recipe in this visit, or `original` when none (or anything unusable) is stored. */
export function readServings(recipeId: string, original: number): number {
  try {
    const raw = window.sessionStorage.getItem(key(recipeId));
    if (raw === null) return original;
    const n = Number(raw);
    return Number.isInteger(n) && n >= MIN_SERVINGS && n <= MAX_SERVINGS ? n : original;
  } catch {
    return original;
  }
}

/** Remember the choice; choosing the original number forgets it. */
export function writeServings(recipeId: string, value: number, original: number): void {
  try {
    if (value === original) window.sessionStorage.removeItem(key(recipeId));
    else window.sessionStorage.setItem(key(recipeId), String(value));
  } catch {
    // Storage can be blocked; the choice just will not carry to the other screen.
  }
}
