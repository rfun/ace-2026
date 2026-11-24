import { COURSES } from '../../domain/tags';
import type { Course, DietaryTag } from '../../domain/types';
import { isoDurationToMinutes } from './duration';
import { splitIngredient } from './ingredient';
import { normalizeImported } from './normalize';
import type { ImportedRecipe } from './types';

const MAX_ATTEMPTS = 60;

/** Pull every top-level JSON object out of text that may be page source (string-aware brace matching). */
function jsonObjects(text: string): unknown[] {
  const found: unknown[] = [];
  let attempts = 0;
  let i = text.indexOf('{');
  while (i !== -1 && attempts < MAX_ATTEMPTS) {
    let depth = 0;
    let inStr = false;
    let end = -1;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (c === '\\') j++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        end = j;
        break;
      }
    }
    if (end === -1) break;
    attempts++;
    const chunk = text.slice(i, end + 1);
    if (!chunk.includes('"@type"')) {
      i = text.indexOf('{', end + 1);
      continue;
    }
    try {
      found.push(JSON.parse(chunk));
      i = text.indexOf('{', end + 1);
    } catch {
      i = text.indexOf('{', i + 1);
    }
  }
  return found;
}

function isRecipeNode(n: unknown): n is Record<string, unknown> {
  if (typeof n !== 'object' || n === null || Array.isArray(n)) return false;
  const t = (n as Record<string, unknown>)['@type'];
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
}

function findRecipe(n: unknown, depth = 0): Record<string, unknown> | undefined {
  if (depth > 6) return undefined;
  if (Array.isArray(n)) {
    for (const x of n) {
      const r = findRecipe(x, depth + 1);
      if (r) return r;
    }
    return undefined;
  }
  if (isRecipeNode(n)) return n;
  if (typeof n === 'object' && n !== null) {
    const g = (n as Record<string, unknown>)['@graph'];
    if (g) return findRecipe(g, depth + 1);
  }
  return undefined;
}

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
/** Page-source text may carry tags and entities. The result is still only ever rendered as text. */
function plain(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function strings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  return [];
}

function stepTexts(v: unknown, depth = 0): string[] {
  if (depth > 4) return [];
  if (typeof v === 'string') return v.split(/\r?\n/).map((s) => plain(s)).filter(Boolean);
  if (Array.isArray(v)) return v.flatMap((x) => stepTexts(x, depth + 1));
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>;
    if (o.itemListElement) return stepTexts(o.itemListElement, depth + 1);
    const t = typeof o.text === 'string' ? o.text : typeof o.name === 'string' ? o.name : '';
    return t ? [plain(t)] : [];
  }
  return [];
}

function yieldText(v: unknown): string | undefined {
  const all = (Array.isArray(v) ? v : [v]).map((x) => (typeof x === 'number' ? String(x) : x)).filter((x): x is string => typeof x === 'string');
  if (all.length === 0) return undefined;
  const pick = all.find((s) => /\D/.test(s.trim())) ?? all[0];
  const t = pick.trim();
  return /^\d+$/.test(t) ? `Serves ${t}` : t;
}

/** A numeric recipeYield (4, "4", "4 servings") is a portion count; "24 ladoos" is not. */
function yieldServes(v: unknown): number | undefined {
  for (const x of Array.isArray(v) ? v : [v]) {
    const s = typeof x === 'number' ? String(x) : typeof x === 'string' ? x.trim() : '';
    const m = /^(\d{1,3})(?:\s*servings?)?$/i.exec(s);
    if (m) return Number(m[1]);
  }
  return undefined;
}

const DIET_MAP: Record<string, DietaryTag> = {
  vegetariandiet: 'vegetarian',
  vegandiet: 'vegan',
  glutenfreediet: 'gluten-free',
  kosherdiet: 'kosher',
  halaldiet: 'halal',
};

function courseFrom(v: unknown): Course | undefined {
  for (const s of strings(v)) {
    const k = s.trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(COURSES, k)) return k as Course;
  }
  return undefined;
}

/** Find a schema.org Recipe in pasted text (page source or a bare JSON-LD block) and map it. */
export function recipeFromJsonLd(text: string): ImportedRecipe | undefined {
  if (!/"@type"/.test(text)) return undefined;
  let node: Record<string, unknown> | undefined;
  const blocks: unknown[] = [];
  for (const m of text.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch {
      // not valid JSON: the brace scan below may still find it
    }
  }
  for (const obj of [...blocks, ...jsonObjects(text)]) {
    node = findRecipe(obj);
    if (node) break;
  }
  if (!node) return undefined;

  const total = typeof node.totalTime === 'string' ? isoDurationToMinutes(node.totalTime) : undefined;
  const prep = typeof node.prepTime === 'string' ? isoDurationToMinutes(node.prepTime) : undefined;
  const cook = typeof node.cookTime === 'string' ? isoDurationToMinutes(node.cookTime) : undefined;
  const sum = (prep ?? 0) + (cook ?? 0);

  const dietary = strings(node.suitableForDiet)
    .map((s) => DIET_MAP[s.replace(/^.*\//, '').toLowerCase()])
    .filter((d): d is DietaryTag => !!d);

  const cuisine = strings(node.recipeCuisine)[0];
  const description = typeof node.description === 'string' ? plain(node.description) : undefined;

  const raw: Record<string, unknown> = {
    title: typeof node.name === 'string' ? plain(node.name) : undefined,
    story: description,
    origin: cuisine ? plain(cuisine) : undefined,
    course: courseFrom(node.recipeCategory),
    dietary,
    serves: yieldServes(node.recipeYield),
    makes: yieldText(node.recipeYield),
    totalMinutes: total ?? (sum > 0 ? sum : undefined),
    ingredients: strings(node.recipeIngredient).map((s) => splitIngredient(plain(s))),
    steps: stepTexts(node.recipeInstructions),
  };
  return normalizeImported(raw);
}
