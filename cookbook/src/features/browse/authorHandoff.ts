/**
 * One-shot handoff from the recipe page to browse: "show me everything from this person".
 * The recipe page calls setAuthorHandoff(id) then navigates to browse; browse peeks it when it opens
 * and clears it once mounted. Kept in memory only, so a reload starts browse unfiltered.
 */
let pending: string | undefined;

export function setAuthorHandoff(authorId: string): void {
  pending = authorId;
}

export function peekAuthorHandoff(): string | undefined {
  return pending;
}

export function clearAuthorHandoff(): void {
  pending = undefined;
}
