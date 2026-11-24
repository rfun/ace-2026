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
  makes?: string; totalMinutes?: number;
  story: string; ingredients: Ingredient[]; steps: Step[]; mainPhoto?: Photo;
  createdAt: number; updatedAt: number; hidden?: boolean; sample?: boolean;
}
export type RecipeDraft = Omit<Recipe, 'id' | 'authorId' | 'createdAt' | 'updatedAt'>;
export interface Tip { id: string; recipeId: string; authorId: UserId; text: string; photo?: Photo; createdAt: number; hidden?: boolean; sample?: boolean }
export interface Person { id: UserId; name: string }
export interface Me { id: UserId; canWrite: boolean; canModerate: boolean }
