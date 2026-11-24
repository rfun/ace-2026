import { useCallback, useState } from 'react';
import { clampServings, readServings, scaleQuantity, writeServings } from '../../lib/scale';
import type { Ingredient } from '../../domain/types';

export interface ServingsView {
  /** The recipe's own portion count, or undefined when it has none (no scaler is shown). */
  original: number | undefined;
  /** The count being shown. Equals `original` until the member changes it. */
  servings: number | undefined;
  changed: boolean;
  set: (n: number) => void;
  reset: () => void;
  /** Quantities as they should be shown now. Never the stored objects: the recipe itself is not touched. */
  scaled: Array<{ quantity: string; item: string; scalable: boolean }>;
  /** True when servings differ from the original and at least one amount has no number to scale. */
  hasUnscaled: boolean;
}

/**
 * The servings choice for one recipe. It is shared with the other screen through sessionStorage (see lib/scale),
 * so kitchen mode opens with the amounts the card was showing.
 */
export function useServings(recipeId: string, original: number | undefined, ingredients: Ingredient[]): ServingsView {
  // Only a choice made for this recipe id counts; switching recipes falls back to the stored value.
  const [picked, setPicked] = useState<{ id: string; n: number } | null>(null);
  const servings =
    original === undefined ? undefined : picked && picked.id === recipeId ? picked.n : readServings(recipeId, original);

  const set = useCallback(
    (n: number) => {
      if (original === undefined) return;
      const next = clampServings(n);
      writeServings(recipeId, next, original);
      setPicked({ id: recipeId, n: next });
    },
    [recipeId, original],
  );
  const reset = useCallback(() => {
    if (original !== undefined) set(original);
  }, [original, set]);

  const factor = original === undefined || servings === undefined ? 1 : servings / original;
  const scaled = ingredients.map((ing) => {
    const r = scaleQuantity(ing.quantity, factor);
    return { quantity: r.text, item: ing.item, scalable: r.scaled };
  });
  const changed = original !== undefined && servings !== original;
  return { original, servings, changed, set, reset, scaled, hasUnscaled: changed && scaled.some((s) => !s.scalable) };
}
