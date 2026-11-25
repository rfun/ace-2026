import type { MadeNote, RecipeStats, Shelf, ShelfState, UserId } from './types';

/**
 * Counts per recipe. madeBy = distinct people who posted a non-hidden made note OR have the recipe on
 * their made shelf; wantCount = people with it on their want shelf (a person who also made it is not
 * counted as wanting it). Only recipes that appear somewhere get an entry.
 */
export function computeStats(notes: readonly MadeNote[], shelves: Readonly<Record<UserId, Shelf>>): Record<string, RecipeStats> {
  const made = new Map<string, Set<UserId>>();
  const want = new Map<string, Set<UserId>>();
  const add = (m: Map<string, Set<UserId>>, recipeId: string, person: UserId) => {
    let set = m.get(recipeId);
    if (!set) m.set(recipeId, (set = new Set()));
    set.add(person);
  };
  for (const n of notes) if (!n.hidden) add(made, n.recipeId, n.authorId);
  for (const [person, shelf] of Object.entries(shelves)) {
    for (const id of shelf.made) add(made, id, person);
    for (const id of shelf.want) if (!shelf.made.includes(id)) add(want, id, person);
  }
  const out: Record<string, RecipeStats> = {};
  for (const id of new Set([...made.keys(), ...want.keys()])) {
    out[id] = { madeBy: made.get(id)?.size ?? 0, wantCount: want.get(id)?.size ?? 0 };
  }
  return out;
}

/** The shelf after moving one recipe to a state; want/made stay exclusive and deduped. Pure: input untouched. */
export function applyShelfState(shelf: Shelf, recipeId: string, state: ShelfState): Shelf {
  const want = shelf.want.filter((id) => id !== recipeId);
  const made = shelf.made.filter((id) => id !== recipeId);
  if (state === 'want') want.push(recipeId);
  if (state === 'made') made.push(recipeId);
  return { want, made };
}
