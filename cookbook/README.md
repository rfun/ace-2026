# ACE Cookbook

Vite + React 18 + TypeScript app. Built into a single self-contained page that is published as a Claude artifact.

## Commands

```
npm ci            # install exact pinned dependencies
npm run dev       # dev server
npm run typecheck # tsc strict
npm test          # vitest (jsdom)
npm run build     # emits dist/index.html and dist/heic-to.js
npm run check:dist # pre-publish checks on dist/ (run after build)
npm run release   # typecheck, test, build, then check:dist; exits non-zero on any failure
```

`dist/index.html` has all JS and CSS inlined (vite-plugin-singlefile) and is the artifact page. Only the Google Fonts stylesheet is loaded externally. The one exception is the HEIC converter, `dist/heic-to.js`, a separate file (see Publishing).

Data goes through the `DataStore` interface (`src/data/store.ts`); `createMockStore()` is the in-memory/localStorage implementation seeded with clearly-fake sample recipes.

## Publishing

1. `npm run release` (typecheck, tests, build, dist check). Fix anything it reports.
2. Publish `dist/index.html` as the artifact page, declaring `CAPABILITIES` from `src/data/artifact/runtime.ts`, **and publish `dist/heic-to.js` beside it** (the Artifact tool's `files` map: `{ "heic-to.js": "cookbook/dist/heic-to.js" }`). Publish exactly these two files; `npm run check:dist` fails if either is missing or if `index.html` grows past 400 KB.

### The HEIC converter (`dist/heic-to.js`)

iPhone photos are HEIC. Safari reads them natively; Chrome and Edge on Windows do not. The photo pipeline (`src/lib/image/prepare.ts`) tries the browser's own decoder first. Only if that fails for a HEIC/HEIF file does it fetch `./heic-to.js` (relative to the page, once per page load, cached) and convert to JPEG before the normal resize. Nobody downloads the roughly 3 MB file unless they pick a HEIC their browser cannot read. A raw HEIC is never uploaded.

- The file is the `csp` build of [heic-to](https://github.com/hoppergee/heic-to) (no `unsafe-eval`), copied unmodified from `node_modules` by `scripts/heic-converter-plugin.mjs` during `vite build`. It is not bundled into the page.
- If it is not published next to the page, HEIC photos fail with the message "We couldn't convert that iPhone photo. Share it as a JPG ...". Other photos are unaffected.
- Licence and attribution: `THIRD_PARTY_NOTICES.md`.

## Import a recipe

On the new-recipe screen, "Import a recipe" pre-fills the form from pasted text or a photo of a recipe card. It never saves. Parsers live in `src/lib/import/`: a local reader (headings, lists, JSON-LD) that always works, and Claude via the `sample` capability (manifest `sample: { images: true }`, see `CAPABILITIES`) when running in claude.ai. No URL fetching: copy the page text and paste it.

## Search, filters and keywords

The search box on the browse screen matches a recipe's title, origin, occasions, keywords, story, the contributor's display name, ingredient names (not amounts) and steps. It ignores case and accents, and every word typed must match somewhere. Beside it the filter panel groups Dietary, Origin, Occasion, Keywords and Contributor: OR inside a group, AND across groups (dietary needs every selected tag), each choice counted in "Filters (n)". Clicking "From the kitchen of X" on a card or recipe page opens browse filtered to that contributor (by id, so two people with the same name stay apart) with a removable "From X's kitchen" chip. The recipe page hands that choice to browse through `src/features/browse/authorHandoff.ts` (one-shot, in memory).

**Keywords** are free-form tags the author adds ("noodles", "soup"). In the data `tags` is optional (`Recipe.tags?: string[]`) so older recipes load. They are normalised on save and on read (`normalizeTags` in `src/domain/types.ts`): trimmed, lower-cased, inner spaces collapsed, empties and duplicates dropped, at most 10 per recipe and 1 to 24 characters each. On the compose screen, type a word and press Enter or comma to add a chip, Backspace in the empty box removes the last one, and pasting "noodles, soup" adds both. The recipe card shows them as small text chips; clicking one opens browse filtered to that keyword (`src/features/browse/tagHandoff.ts`). When importing with Claude, up to 5 suggested keywords fill only an empty Keywords field; the local text reader suggests none.

## I made this notes, shelf lists and browse additions

**"I made this" notes** are a section on the recipe page after the steps, separate from Tips (tips sit in the margin and are advice to the next cook; made notes say how it went for someone who cooked it). A note is 1 to 600 characters with an optional photo (same photo flow as tips). There are no ratings, stars or scores anywhere. Anyone who can write can post; moderators see a Hide / Unhide button on each note. Hiding is display-level only (see Moderation and privacy). Kitchen mode's final card links to the composer (`src/features/made/handoff.ts`). Code: `src/features/made/` (`counts.ts` pure wording, `ShelfButtons`, `MadeSection`, `MadeComposer`).

**Want to make / Made it** are two toggles in the recipe card header. One at a time: pressing the pressed one clears it, and a recipe is never on both lists (Made it wins). Posting a made note also puts the recipe on Made it. The recipe page shows only counts, in a quiet line such as "Made by 4 · 6 want to make" (a zero part is left out). "Made by N" counts distinct people who have a visible made note or the recipe on their Made it list.

**Privacy of shelves, stated plainly.** The screen shows only counts, never who is on a list. But each person's lists are stored in a `shelf/<id>` document that any signed-in member of the artifact can read through the db API, and made notes are in `made/<id>` documents readable the same way. Do not describe shelves as private to members; they are private only in what the app displays.

**db rules** (`CAPABILITIES` in `src/data/artifact/runtime.ts`, republish after any change): `made` and `shelf` are read `view` and write `admin` at the collection level; `made/{self}` and `shelf/{self}` are read `view` and write `interact`, so a person writes only their own document. Moderation hiding lives in the existing `moderation` document (a `made` key beside `recipes` and `tips`).

**Moderation and privacy.** Hiding a made note removes it from everyone but moderators, and from the "Made by" count. It does not delete the data; a member could still read the hidden note through the db API.

**Browse additions** (`src/features/browse/filters.ts`, `BrowsePage.tsx`): a "My shelf" filter group (Want to make, Made it, Not tried; single choice; shown only to people who can add recipes and when the shelf loaded; Not tried means on neither list), and a "Recipes" group with "My recipes" (I am the author) and "New this week" (added in the last 7 days; exactly 7 days still counts). All groups AND together. On phones a "Want to make" chip sits beside the course chips. Cards show text badges "Made by N" (from 1), "New", and for your own shelf "On your list" / "You made this". Sort is Newest (default) or Most made (made by, then wanted by, then newest), remembered only while the page is open. Stats and shelf load with the recipes and refresh on store updates; if stats fail there are no badges and Most made equals Newest; if the shelf fails the shelf controls and markers are hidden.

## Serves and scaling

Every new or edited recipe needs a **Serves** number (a whole number from 1 to 100, the portions the written quantities make). "Makes" stays an optional free-text note ("24 ladoos"). In the data, `serves` is optional so older recipes still load; they simply show no scaler.

A recipe with `serves` shows a "Serves N" control by its ingredients, on the recipe card and in kitchen mode (the Gather card). The `-` / `+` buttons change the portions, Reset goes back. Scaling is a view only: nothing is saved, and edits, tips and the store always see the original quantities.

Rules (`src/lib/scale/scaleQuantity.ts`): only the leading number or range of an ingredient's amount is scaled, and units and words are kept as written (no unit conversion, no re-pluralising). It reads integers, decimals, unicode fractions (`½`, `1½`, `1 ½`), ASCII fractions (`1/2`, `1 1/2`) and ranges (`1-2`, `1 – 2`, `2 to 3`). Results are whole numbers, or rounded to the nearest of 1/8, 1/4, 1/3, 1/2, 2/3, 3/4 shown as glyphs (`2¼`); an amount written with a decimal stays a decimal (at most 2 places). A result is never shown as 0. Amounts with no leading number ("a pinch", "to taste", empty) stay as written, and a small note says so while the servings differ from the original.

The chosen servings are passed between the recipe card and kitchen mode through `sessionStorage` (`cookbook.servings.<recipe id>`, see `src/lib/scale/servings.ts`), so kitchen mode opens with the amounts the card was showing for this visit. Choosing the original number clears it.
