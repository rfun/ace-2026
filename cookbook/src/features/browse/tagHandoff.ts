/**
 * One-shot handoff from the recipe page to browse: "show me everything with this keyword".
 * Same shape as authorHandoff: the recipe page calls setTagHandoff(tag) then navigates to browse;
 * browse peeks it when it opens and clears it once mounted. In memory only, so a reload starts unfiltered.
 */
let pending: string | undefined;

export function setTagHandoff(tag: string): void {
  pending = tag;
}

export function peekTagHandoff(): string | undefined {
  return pending;
}

export function clearTagHandoff(): void {
  pending = undefined;
}
