import type { MadeNote, Me, Person, Photo, Recipe, RecipeDraft, RecipeStats, Shelf, ShelfState, Tip, UserId } from '../domain/types';

export interface DataStore {
  me(): Promise<Me>;
  people(ids: UserId[]): Promise<Record<UserId, Person>>;
  listRecipes(): Promise<Recipe[]>;
  getRecipe(id: string): Promise<Recipe | null>;
  saveRecipe(draft: RecipeDraft & { id?: string }): Promise<Recipe>;
  listTips(recipeId: string): Promise<Tip[]>;
  addTip(recipeId: string, tip: { text: string; photo?: Photo }): Promise<Tip>;
  listMade(recipeId: string): Promise<MadeNote[]>;
  /** Posting also puts the recipe on the poster's made shelf (and off want). */
  addMade(recipeId: string, note: { text: string; photo?: Photo }): Promise<MadeNote>;
  myShelf(): Promise<Shelf>;
  setShelf(recipeId: string, state: ShelfState): Promise<Shelf>;
  /** Counts for every recipe in one call. Never says who. */
  stats(): Promise<Record<string, RecipeStats>>;
  setHidden(kind: 'recipe' | 'tip' | 'made', id: string, hidden: boolean): Promise<void>;
  uploadPhoto(file: Blob, alt: string): Promise<Photo>;
  subscribe(listener: () => void): () => void;
}
