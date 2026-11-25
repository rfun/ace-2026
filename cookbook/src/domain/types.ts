export type UserId = string;
export type AssetId = string;
export type DietaryTag = 'vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free' | 'nut-free' | 'egg-free' | 'halal' | 'kosher';
export type Course = 'breakfast' | 'snack' | 'main' | 'side' | 'dessert' | 'sweets' | 'drink' | 'condiment';
export interface Photo { assetId: AssetId; url: string; alt: string }
export interface Ingredient { quantity: string; item: string }
export interface Step { id: string; text: string; photo?: Photo }
export interface Recipe {
  id: string; title: string; authorId: UserId;
  team?: string; city?: string;
  origin: string; occasions: string[]; course: Course; dietary: DietaryTag[];
  /** Free-form search keywords the author chose ("noodles", "soup"). Optional: older recipes have none. Keep them through normalizeTags. */
  tags?: string[];
  /** Portions the quantities are written for (1..100). Optional: older recipes have none and show no scaler. */
  serves?: number;
  makes?: string; totalMinutes?: number;
  story: string; ingredients: Ingredient[]; steps: Step[]; mainPhoto?: Photo;
  createdAt: number; updatedAt: number; hidden?: boolean; sample?: boolean;
}
export type RecipeDraft = Omit<Recipe, 'id' | 'authorId' | 'createdAt' | 'updatedAt'>;
export interface Tip { id: string; recipeId: string; authorId: UserId; text: string; photo?: Photo; createdAt: number; hidden?: boolean; sample?: boolean }
/** An "I made this" note: separate from a Tip, so a recipe can show how many people made it. Text is 1..600 chars. */
export interface MadeNote { id: string; recipeId: string; authorId: UserId; text: string; photo?: Photo; createdAt: number; hidden?: boolean; sample?: boolean }
/** One person's recipe ids: deduped, and a recipe is never in both lists (made wins over want). */
export interface Shelf { want: string[]; made: string[] }
export type ShelfState = 'want' | 'made' | 'none';
/** madeBy: distinct people with a visible made note or the recipe on their made shelf. wantCount: people with it on want. */
export interface RecipeStats { madeBy: number; wantCount: number }
export interface Person { id: UserId; name: string }
export interface Me { id: UserId; canWrite: boolean; canModerate: boolean }

export const MAX_TAGS = 10;
export const TAG_MAX_LENGTH = 24;

/** One keyword in its stored form: trimmed, lower-case, inner whitespace collapsed to single spaces. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * The keywords as they are stored: each normalised, empties/duplicates/over-long ones (more than
 * TAG_MAX_LENGTH characters) dropped, at most MAX_TAGS kept in the order given.
 */
export function normalizeTags(raw: readonly string[]): string[] {
  const out: string[] = [];
  for (const r of raw) {
    const t = normalizeTag(r);
    if (t.length === 0 || t.length > TAG_MAX_LENGTH || out.includes(t)) continue;
    out.push(t);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}
