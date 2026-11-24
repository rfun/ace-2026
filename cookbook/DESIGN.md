# Design system: CHG Culture Cookbook

Recorded from the shipped build (`src/styles/*.css`, `src/features/*/*.css`, `src/domain/tags.ts`, `src/features/recipe/pens.ts`) and the screenshots in the build's `shots/` folder. Where this file and the code disagree, the code wins; fix this file.

## The world: Recipe Card Tin

The app is a recipe tin. The page ground is the tin's dark teal enamel. Everything readable is a card lifted out of it: ruled index-card stock with blue lines and a single red margin line. Navigation is kraft divider tabs. Typed fields (titles, labels, buttons) use a typewriter face; prose uses a reading serif that sits on the rules; tips are handwritten in each person's own pen colour. Photos are white-bordered snapshots held on with a strip of tape, and dietary tags are rubber stamps.

## Colour (`src/styles/tokens.css`)

Contrast figures are WCAG 2.x ratios computed from the token hex values; `src/domain/contrast.test.ts` enforces the 4.5:1 floor for the ones marked (test).

| Role | Token | Value | Notes |
|---|---|---|---|
| Enamel (page ground) | `--enamel` | #1f4f4a | `body` background. Card-colour text on it: 8.6:1 |
| Enamel deep | `--enamel-deep` | #163b37 | header bar, filter panel. Card text 11.5:1, `--kraft` text 4.9:1 |
| Kraft | `--kraft` | #c69c6d | tabs, chips, card-edge borders, button offset |
| Kraft ink | `--kraft-ink` | #4a3420 | text on kraft, 4.6:1 |
| Card | `--card` | #fbf7ee | the default card stock; also `--stock` default |
| Paper white | `--paper-white` | #ffffff | snapshot borders, alt-text field |
| Rule | `--rule` | #9fb7d6 | blue lines; at least 1.3:1 on each stock (test) |
| Margin (rule red) | `--margin` | #d2493f | the margin line, step numerals, invalid-field border. Never for text (4.1:1 on card) |
| Margin ink (text red) | `--margin-ink` | #a63029 | red text only: `.label`, errors. 6.4:1 on card, 4.7:1 minimum across stocks (test) |
| Ink | `--ink` | #23305c | main text; 11.9:1 on card, 8.8:1 minimum across stocks (test) |
| Ink soft | `--ink-soft` | #4b5577 | secondary text; 6.9:1 on card, 5.1:1 minimum (test) |
| Tape | `--tape` | rgba of kraft at .65 | snapshot tape |

Course stocks. Each course in `COURSES` (`src/domain/tags.ts`) names a stock; `stockClass(course)` returns the class, and a card sets `--stock` from it. Unknown courses fall back to plain card.

| Stock token / class | Value | Courses |
|---|---|---|
| `--stock-canary` / `.stock-canary` | #f6e7a1 | breakfast, snack |
| `--stock-blush` / `.stock-blush` | #f3cfc6 | main, dessert, sweets |
| `--stock-mint` / `.stock-mint` | #cfe6d3 | side, condiment |
| `--stock-sky` / `.stock-sky` | #cfe0f1 | drink |

Pens (tip handwriting). `penFor(userId)` hashes a user id onto four fixed pens: `--pen-navy` #23305c, `--pen-green` #2f6b3f, `--pen-violet` #8a2d5c, `--pen-graphite` #55585e. Used by `.rc-pen-*` (shown tips) and `.tips-pen-*` (composer). Pens are 4.4:1 or better on every stock and 6.0:1 or better on card, where tips are written. Pen assignment by hash (not user choice) is the build's answer to the open question.

Stamp inks, one fixed ink per dietary tag (`DIETARY`): `--stamp-green` vegetarian, `--stamp-olive` vegan, `--stamp-umber` gluten-free, `--stamp-navy` dairy-free, `--stamp-rust` nut-free, `--stamp-graphite` egg-free, `--stamp-teal` halal, `--stamp-violet` kosher. Each is 4.5:1 or better on card and all stocks (test).

Shadows: `--shadow-card`, `--shadow-tile` (cards on enamel), `--shadow-snap` (snapshots), `--shadow-tab` (inset, makes an inactive tab look recessed). Radii: `--radius-card` 6px, `--radius-card-top` (6px 10px 0 0, card with square bottom edge).

## Type

Faces (loaded from Google Fonts in `index.html`): `--font-typed` Courier Prime (kept by owner decision), `--font-read` Literata with Noto Serif and Georgia fallbacks, `--font-hand` Caveat with cursive fallback.

Roles and sizes as built:
- Typed: titles (recipe 52/60 desktop, 40/48 under 1024px, 34/40 phone; browse card title 28/32; compose title 44/52; browse h1 34/40, 30/36 phone), by-lines and meta (15 to 18), buttons and labels (17), `.label` uppercase with 0.12em tracking.
- Reading serif: body and form input text on the rules (17 desktop, 18 under 1024px and on phone), hints and notes 17.
- Hand: tips 22/28, signatures 22 to 24, ingredient quantities 22 on the recipe, composer textarea 22/32.
- Kitchen mode scales up for arm's length: step text 32 (30 phone), ingredients 22, title 36 (30 phone), nav buttons 24.

Phone rule: under 601px, any text that is read or tapped is at least 17px. Browse meta, chips and search label, recipe meta and margin labels, tip notes and counts, tab text, stamps (15) and the shell header (17) are raised in the phone media queries.

## Ruled-paper rhythm

`--rule-gap: 32px` (kitchen overrides it to 48px inside `.kt-card`). Rules are drawn as a `repeating-linear-gradient` on the card or ruled region (`.rc-ruled`, `.bw-card`, `.kt-card`), one 1px blue line per gap.

Text-on-rules rule: every block inside a ruled region must total a whole number of rule gaps, so the baseline lands on a line. Body text uses `line-height: var(--rule-gap)`; section gaps are `margin: 0 0 var(--rule-gap)`; do not add padding, margin, border or min-height to list items inside a ruled region unless it is a multiple of `--rule-gap`. Check the pixel pitch in a screenshot after any change (the kitchen gather list once drifted to 53px). The red margin line is a 2px `::before` (recipe at left 260px on desktop, 28px under 1024px; card tiles at 36px; kitchen at 28px, 24px phone).

## Components

Shared pieces live in `src/styles/components.css`; feature CSS adds layout only.

- Buttons: `.btn` (ink fill, typed 17px bold, min-height 44px) and `.btn-prop` (card fill, ink text). Disabled is 0.55 opacity. `.kt-btn` and `.kt-btn-next` in `kitchen.css` are the 72px-high kitchen variants.
- Quiet action: `.quiet` (underlined typed 17px text button, 44px minimum height); `.quiet-light` for use on enamel.
- Labels: `.label` (typed, uppercase, margin-ink, one rule gap tall) and `.label-ink` (ink colour). Used for field legends and the recipe margin heading.
- Snapshot with tape: `.snap` (white 6px border, `--shadow-snap`, tape strip via `::before`). The screen sets size and tilt: `.rc-snap-main`, `.rc-snap-step`, `.rc-snap-tip`, `.bw-snap`, `.cp-snap`, `.kt-photo`; the composer preview `.tips-preview` repeats the look.
- Stamps: `.stamp` plus one `.stamp-<ink>` class, which sets ink and a fixed tilt per tag. `.stamp-sample` is a dashed ink variant for example recipes. Browse tiles shrink stamps to 12px desktop, 15px phone.
- Tabs: kraft divider tabs `.rc-tab`, `.cp-tab` (active `.cp-tab-on` is card colour and sits flush); browse filter chips `.bw-chip` and `.bw-chip-on`. On a phone the recipe tabs collapse to one back tab `.rc-tab-back` with `.rc-where` crumbs hidden.
- Tips: `.rc-tip` with `.rc-tilt-0/1/2`, `.rc-hand` text, `.rc-sign` signature; composer is `.tips-composer` with a ruled `.tips-area`.
- Focus: one pair in `components.css`. On a card, a 3px `--ink` outline with a 6px `--card` halo; inside `.on-enamel`, a `--card` outline with an `--ink` halo. `.shell-home` and `.cp-summary` override for their own surfaces.

## Screens

- Browse (`browse.css`, root `.bw-ground`, max 1200px). Desktop: typed h1, search, course row, collapsible filter panel on enamel-deep, then a grid of card tiles (`minmax(300px, 1fr)`, 24px gap) each on its course stock with a corner snapshot and stamps. Phone: single column, 12px side padding, filters behind a toggle (`.bw-filters-open`), larger chips.
- Recipe (`recipe.css`, root `.rc-ground`, max 1200px). Desktop: tabs above a card; stock-coloured head with title, by-line, meta, stamps and the main snapshot at top right; below, a 260px margin column of tips left of the red line, and the ruled body (story, ingredients, numbered steps in hand numerals) with step snapshots floated into the right gutter. While writing a tip the margin takes full width below the body. Under 1024px: one column, tips as a strip beneath the steps, snapshots inline. Phone: back tab, 18px body.
- Compose (`compose.css`, root `.cp-ground`, max 960px). A blank card being filled in: tabs, head, ruled body with a margin line, two-column fields on desktop (`.cp-cols`), one column on phone, 44 to 48px targets, a summary band in blush with red borders for errors, and a footer with actions (full-width buttons on phone).
- Tips (`tips.css`, root `.tips-composer`). The in-margin composer: handwritten ruled textarea in the writer's pen, optional photo, character count, confirm row.
- Kitchen (`kitchen.css`, root `.kt-ground`, fixed full-screen). One large card per step on enamel, 48px rule gap, max 820px, a sticky two-button nav (back, next). Ingredient gather list uses checkboxes whose text is struck through when checked.

## Motion

- Pen-stroke reveal: a newly added tip's text animates with `rc-pen` (700ms, `clip-path` inset from the right) on `.rc-tip-new .rc-hand`.
- Kitchen step change: `kt-in` (220ms slide 24px and fade) on `.kt-slide`.
- Tap press: `.btn:active` nudges 1px.
- Both animations are disabled under `prefers-reduced-motion: reduce`.

## Accessibility commitments

- Text meets 4.5:1 on every ground it is used on, enforced by `contrast.test.ts`; red text uses `--margin-ink`, never `--margin`.
- Targets are at least 44px on phone (buttons, quiet actions, checkboxes, chips); kitchen buttons are 72px.
- Phone text at least 17px (see Type).
- Visible focus on every control on both card and enamel grounds; the visually hidden photo input shows focus on its button (`.cp-ground input.sr-only:focus-visible + .cp-filebtn`). `.sr-only` is the hidden-text utility.
- Form errors are in text with `aria-invalid` styling, not colour alone.
- Overflow-wrap is set on titles so non-Latin and long titles do not break layout.

## Adding a feature: do and don't

Do:
- Scope every rule under the feature's own root class (`.bw-`, `.rc-`, `.cp-`, `.kt-`, `.tips-` style prefix). All feature CSS is bundled globally, so unscoped rules leak.
- Use tokens only: colours, fonts, `--rule-gap`, radii and shadows come from `tokens.css`. Reuse `.btn`, `.quiet`, `.label`, `.snap`, `.stamp`, `.stock-*`.
- Keep text-on-rules blocks to whole multiples of `--rule-gap`.
- Add a new stock, pen or stamp ink as a token plus its class, and add it to the contrast test.
- Honour the phone floor and reduced-motion queries.

Don't:
- Don't restyle `.shell-*` classes or bare elements (`body`, `main`, `a`, `button`) from a feature stylesheet.
- Don't put a hex or rgba colour in feature CSS.
- Don't use `--margin` for text, or colour alone to carry meaning.
- Don't add ratings, rankings or a default culture to the visual language (product principle).

## Not canonized (defects and drift in the build)

Recorded so future surfaces do not inherit them:
- `.btn` carries a hard offset shadow (`2px 3px 0 var(--kraft)`); a hard offset shadow is not part of this world's vocabulary.
- Stamp and course symbols in `src/domain/tags.ts` are text glyphs used as icons.
- Some desktop sizes fall under the phone floor's spirit: `.rc-hidden-note` 12px, `.bw-legend` 13px, `.stamp-sample` 12px; they are raised on phone only.
- `tips.css` `.tips-area` hard-codes 32px/31px in its ruled gradient instead of `--rule-gap`.
- Tab and chip colours repeat between `.rc-tab`, `.cp-tab` and `.bw-chip` rather than sharing one component.
