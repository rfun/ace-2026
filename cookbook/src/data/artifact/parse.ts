import type { Course, DietaryTag, Ingredient, Photo, Recipe, Step, Tip } from '../../domain/types';

// Everything read from the db is untrusted: guards below rebuild clean objects
// and drop anything with missing or wrongly typed required fields.

const COURSES: readonly Course[] = ['breakfast', 'snack', 'main', 'side', 'dessert', 'sweets', 'drink', 'condiment'];
const DIETARY: readonly DietaryTag[] = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'egg-free', 'halal', 'kosher'];

export const blobUrl = (assetId: string): string => '/_blob/' + assetId;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const optStr = (v: unknown): string | undefined => (str(v) && v !== '' ? v : undefined);

// Asset ids end up in a URL path: accept only a conservative token (no slashes, dots or empties).
const ASSET_ID = /^[A-Za-z0-9_-]{1,128}$/;

function parsePhoto(v: unknown): Photo | undefined {
  if (!isObj(v) || !str(v.assetId) || !ASSET_ID.test(v.assetId)) return undefined;
  return { assetId: v.assetId, url: blobUrl(v.assetId), alt: str(v.alt) ? v.alt : '' };
}

function parseIngredient(v: unknown): Ingredient | null {
  if (!isObj(v) || !str(v.quantity) || !str(v.item)) return null;
  return { quantity: v.quantity, item: v.item };
}

function parseStep(v: unknown): Step | null {
  if (!isObj(v) || !str(v.id) || !str(v.text)) return null;
  const step: Step = { id: v.id, text: v.text };
  const photo = parsePhoto(v.photo);
  if (photo) step.photo = photo;
  return step;
}

function strings(v: unknown): string[] | null {
  return Array.isArray(v) && v.every(str) ? (v as string[]) : null;
}

/** Returns a clean recipe (authorId stamped by caller), or null if malformed. */
export function parseRecipe(raw: unknown, authorId: string): Recipe | null {
  if (!isObj(raw)) return null;
  if (!str(raw.id) || raw.id === '' || !str(raw.title) || !str(raw.origin) || !str(raw.story)) return null;
  if (!num(raw.createdAt) || !num(raw.updatedAt)) return null;
  if (!str(raw.course) || !COURSES.includes(raw.course as Course)) return null;
  const occasions = strings(raw.occasions);
  const dietary = strings(raw.dietary);
  if (!occasions || !dietary) return null;
  if (!Array.isArray(raw.ingredients) || !Array.isArray(raw.steps)) return null;
  const ingredients = raw.ingredients.map(parseIngredient);
  const steps = raw.steps.map(parseStep);
  if (ingredients.some((i) => i === null) || steps.some((s) => s === null)) return null;

  const recipe: Recipe = {
    id: raw.id,
    title: raw.title,
    authorId,
    origin: raw.origin,
    occasions,
    course: raw.course as Course,
    dietary: dietary.filter((d): d is DietaryTag => DIETARY.includes(d as DietaryTag)),
    story: raw.story,
    ingredients: ingredients as Ingredient[],
    steps: steps as Step[],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
  const team = optStr(raw.team);
  const city = optStr(raw.city);
  const makes = optStr(raw.makes);
  if (team) recipe.team = team;
  if (city) recipe.city = city;
  if (makes) recipe.makes = makes;
  if (num(raw.totalMinutes)) recipe.totalMinutes = raw.totalMinutes;
  const mainPhoto = parsePhoto(raw.mainPhoto);
  if (mainPhoto) recipe.mainPhoto = mainPhoto;
  return recipe;
}

export function parseTip(raw: unknown, authorId: string): Tip | null {
  if (!isObj(raw)) return null;
  if (!str(raw.id) || raw.id === '' || !str(raw.recipeId) || !str(raw.text) || !num(raw.createdAt)) return null;
  const tip: Tip = { id: raw.id, recipeId: raw.recipeId, authorId, text: raw.text, createdAt: raw.createdAt };
  const photo = parsePhoto(raw.photo);
  if (photo) tip.photo = photo;
  return tip;
}

export interface Hidden {
  recipes: Record<string, true>;
  tips: Record<string, true>;
}

export function parseHidden(raw: unknown): Hidden {
  const out: Hidden = { recipes: {}, tips: {} };
  if (!isObj(raw)) return out;
  for (const kind of ['recipes', 'tips'] as const) {
    const m = raw[kind];
    if (!isObj(m)) continue;
    for (const [k, v] of Object.entries(m)) if (v === true) out[kind][k] = true;
  }
  return out;
}

/** Stored photo shape: only { assetId, alt }; url is always derived on read. */
export function toStoredPhoto(p: Photo | undefined): { assetId: string; alt: string } | undefined {
  return p ? { assetId: p.assetId, alt: p.alt } : undefined;
}
