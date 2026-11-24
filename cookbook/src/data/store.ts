import type { Me, Person, Photo, Recipe, RecipeDraft, Tip, UserId } from '../domain/types';

export interface DataStore {
  me(): Promise<Me>;
  people(ids: UserId[]): Promise<Record<UserId, Person>>;
  listRecipes(): Promise<Recipe[]>;
  getRecipe(id: string): Promise<Recipe | null>;
  saveRecipe(draft: RecipeDraft & { id?: string }): Promise<Recipe>;
  listTips(recipeId: string): Promise<Tip[]>;
  addTip(recipeId: string, tip: { text: string; photo?: Photo }): Promise<Tip>;
  setHidden(kind: 'recipe' | 'tip', id: string, hidden: boolean): Promise<void>;
  uploadPhoto(file: Blob, alt: string): Promise<Photo>;
  subscribe(listener: () => void): () => void;
}
