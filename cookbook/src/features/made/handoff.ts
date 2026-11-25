/**
 * One-shot handoff from kitchen mode to the recipe page: "open on the I-made-this composer".
 * The router has no anchors, so kitchen calls requestMadeComposer() then navigates to the recipe;
 * the recipe page consumes it once loaded, scrolls to the composer and focuses it. In memory only.
 */
let pending = false;

export const MADE_COMPOSER_ID = 'made-composer';

export function requestMadeComposer(): void {
  pending = true;
}

/** True once per request. */
export function consumeMadeComposerRequest(): boolean {
  const was = pending;
  pending = false;
  return was;
}
