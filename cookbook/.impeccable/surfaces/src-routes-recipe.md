---
version: 1
slug: "src-routes-recipe"
primary_target: "src/routes/recipe"
related_targets: []
---

# Surface: recipe page

Scope: the single-recipe view (desktop browse-at-work, phone propped in the kitchen). Mode: Read. Other surfaces (browse/tin, add-a-recipe) inherit this world.

Audience/job: CHG colleagues reading a colleague's recipe, its story, and others' tips; cooking from it on a phone; adding a tip.
Content: title, contributor + team/city, origin, occasion, course, dietary tags, yield/time, story, ingredients, steps (optional photo each), main photo, tips (text, optional photo, author).
Constraints: claude.ai artifact; contributor phone photos of uneven quality must look at home; non-Latin scripts in titles/stories.

## Direction contract

THESIS: The recipe is a ruled index card pulled from a shared tin, and everyone else's tips are written in its margins in their own ink. Refuses the hero-photo-plus-jump-to-recipe recipe-site arrangement.

OWN-WORLD: Full palette. Ground is the tin's enamel (deep teal-green), never desk grey. Kraft divider tabs carry wayfinding. Cards are real card stock: white for the body, tinted stock per course (canary, blush, mint, sky) with the course word printed on it. Blue rules, one red margin line. Typed fields in a typewriter face; body in a screen reading serif sitting on the rules; tips in handwriting, each person a fixed ink (navy, green, red-violet, graphite). Photos are taped-on snapshots. Tags are rubber-stamp marks (symbol + word).

STORY: The reader meets a person first ("From the kitchen of…"), then the dish, sees that others have cooked it and added to it, and leaves a tip of their own.

FIRST VIEWPORT: Desktop: kraft tabs (All recipes / origin / occasion / course) across the top of an enamel ground; one large card fills the width. The card head has a typed title, contributor line, meta and stamps, with the main snapshot taped at top right. The left margin, beyond the red line, holds the tips in ink, with "+ Add your tip" at its foot (primary action). The ruled body holds the story, then ingredients, then numbered steps, with step snapshots taped in the right gutter. Phone: tabs collapse to a single breadcrumb tab, tips move below the steps as a margin strip, and "Prop it up" opens kitchen mode.

FORM: Recipe Card Tin, Impeccable's pick (my #1 grounded candidate; the roll assigned #5, Airmail Letters). seed:046f6c6965784c99

Signature interaction: adding a tip writes it into the margin in your ink with a short pen-stroke reveal. Kitchen mode shows one step per card at arm's-length size; you swipe the card back into the tin to advance.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- Fixed tag vocabulary vs free-form.
- How a person's ink is assigned (hash of user id vs chosen).
