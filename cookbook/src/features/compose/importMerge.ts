import type { Ingredient } from '../../domain/types';
import type { ImportedRecipe } from '../../lib/import';
import { emptySlot, newKey } from './form';
import type { FormState } from './form';

const blank = (s: string) => s.trim().length === 0;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Imported lists that were not applied because the member already has their own. */
export interface PendingLists {
  ingredients?: Ingredient[];
  steps?: string[];
}

export interface MergeResult {
  form: FormState;
  /** Human labels of what was filled, in form order ("title", "9 ingredients"). */
  filled: string[];
  pending: PendingLists;
}

const hasIngredients = (f: FormState) => f.ingredients.some((i) => !(blank(i.quantity) && blank(i.item)));
const hasSteps = (f: FormState) => f.steps.some((s) => !blank(s.text) || s.slot.photo);

/** Fill only what is empty. Never overwrites typed text; lists are replaced only when the form's list is empty. */
export function mergeImported(form: FormState, imp: ImportedRecipe): MergeResult {
  const next: FormState = { ...form };
  const filled: string[] = [];
  const pending: PendingLists = {};

  const text = (key: 'title' | 'story' | 'origin' | 'makes', value: string | undefined, label: string) => {
    if (value && blank(next[key])) {
      next[key] = value;
      filled.push(label);
    }
  };
  text('title', imp.title, 'title');
  text('story', imp.story, 'story');
  text('origin', imp.origin, 'culture or region');
  if (imp.occasions?.length && blank(next.occasions)) {
    next.occasions = imp.occasions.join(', ');
    filled.push('occasions');
  }
  if (imp.course && next.course === '') {
    next.course = imp.course;
    filled.push('course');
  }
  if (imp.dietary?.length && next.dietary.length === 0) {
    next.dietary = [...imp.dietary];
    filled.push('dietary notes');
  }
  if (imp.serves !== undefined && blank(next.serves)) {
    next.serves = String(imp.serves);
    filled.push('servings');
  }
  text('makes', imp.makes, 'makes');
  if (imp.totalMinutes !== undefined && blank(next.minutes)) {
    next.minutes = String(imp.totalMinutes);
    filled.push('total time');
  }

  if (imp.ingredients?.length) {
    if (hasIngredients(form)) pending.ingredients = imp.ingredients;
    else {
      next.ingredients = imp.ingredients.map((i) => ({ key: newKey('i'), quantity: i.quantity, item: i.item }));
      filled.push(plural(imp.ingredients.length, 'ingredient', 'ingredients'));
    }
  }
  if (imp.steps?.length) {
    if (hasSteps(form)) pending.steps = imp.steps;
    else {
      next.steps = imp.steps.map((t) => ({ key: newKey('s'), text: t, slot: emptySlot() }));
      filled.push(plural(imp.steps.length, 'step', 'steps'));
    }
  }
  return { form: next, filled, pending };
}

/** Add imported ingredients after the member's own, dropping empty trailing rows first. */
export function appendIngredients(form: FormState, list: Ingredient[]): FormState {
  const kept = form.ingredients.filter((i) => !(blank(i.quantity) && blank(i.item)));
  return { ...form, ingredients: [...kept, ...list.map((i) => ({ key: newKey('i'), quantity: i.quantity, item: i.item }))] };
}

/** Add imported steps after the member's own; steps with a photo are kept even if their text is empty. */
export function appendSteps(form: FormState, list: string[]): FormState {
  const kept = form.steps.filter((s) => !blank(s.text) || s.slot.photo);
  return { ...form, steps: [...kept, ...list.map((t) => ({ key: newKey('s'), text: t, slot: emptySlot() }))] };
}

export function describeFilled(filled: string[]): string {
  return filled.length === 0
    ? 'Nothing new to fill in: those fields already have your text.'
    : `Filled ${filled.join(', ')}. Review before saving.`;
}
