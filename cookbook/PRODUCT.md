# Product

<!-- impeccable:product-schema 1 -->


## Platform

web

## Stack

React + Vite + TypeScript, built to static files and published as a Claude artifact on claude.ai (not a deployed server). Runtime capabilities: `db` (shared recipes, tips), `assets` (photo uploads, `upload: "interact"` so Contributors can upload), `user` (attribution, names). Local development runs against a mock data adapter; the published build uses the artifact adapter. External scripts only from cdnjs / jsdelivr / unpkg; stylesheets only from Google Fonts.

## Users

- **Members (contributors and readers):** CHG employees signed in to claude.ai in the CHG org. They browse recipes at their desks during the workday, follow a recipe on their phone in the kitchen, and photograph steps on their phone while cooking to add to a recipe.
- **ACE ambassadors (curators):** started the cookbook, seed the first recipes, and moderate (owner/editors can hide or remove any recipe or tip).

## Product Purpose

Share culture across CHG through food. Members add the recipes that matter to them, with the story behind the dish, photos of the finished dish and individual steps, and their own tips and tricks on each other's recipes. Success: members contribute recipes and tips without being asked, and recipes carry the stories of the people who brought them.

## Positioning

A cookbook written by colleagues, not a recipe site: every recipe is attached to a real CHG person and their story, and others add their own tips to it. It lives inside claude.ai, so signing in and contributing need no extra account.

## Operating Context

- Started by ACE, alongside ACE cultural events (Diwali, Lunar New Year pages in this repo).
- Contributing happens mid-cooking, on a phone, with messy hands: photo uploads per step.
- Reading happens both at a desk (browsing) and on a phone propped in the kitchen (step-by-step).

## Capabilities and Constraints

- Recipes: title, contributor, story, culture/region of origin, festival/occasion, course/meal, dietary tags (vegetarian, vegan, and more), ingredients, ordered steps each with optional photo, main photo.
- Browse and filter by dietary tag, culture/region, festival/occasion, course/meal; browse by contributor and their story.
- Tips: any member can add a tip (text, optional photo) to any recipe, attributed.
- Moderation: recipes publish immediately. Authors edit their own; owner/editors (ambassadors) can hide or remove anything.
- Access: only signed-in CHG claude.ai members with Contributor access can write; Viewers read only. Outside-org viewers cannot contribute.
- Photos: up to 20 MiB per upload; resize client-side before upload.
- Data lives in the artifact platform; an export path is planned.
- Undecided: tag vocabulary (fixed list vs. free-form), comments vs. tips only, printable/export format.

## Brand Commitments

- ACE-branded: the ACE logo (`diwali/ace-logo.png`) appears, as on the Diwali page.
- What the acronym ACE stands for: not yet confirmed. Don't spell it out until confirmed.

## Evidence on Hand

- ACE logo: `diwali/ace-logo.png`. CHG logo: `lny_scratch_cards/CHG_Logo_Stacked_Color.png`.
- No real recipes yet. Ambassadors will supply a few. Mockups use clearly fake placeholder recipes; never invent contributor names presented as real people.

## Product Principles

1. The person comes with the dish: every recipe shows who brought it and why.
2. Contributing is as easy as reading, including from a phone in a kitchen.
3. Every culture is welcome; no culture is the default.
4. Additive, never competitive: tips add to a recipe, no ratings or rankings.

## Accessibility & Inclusion

- Readable at arm's length on a phone in the kitchen (large step text, high contrast).
- Dietary tags must be unambiguous and never conveyed by color alone.
- Recipe names and stories may use non-Latin scripts; typography must support them.
