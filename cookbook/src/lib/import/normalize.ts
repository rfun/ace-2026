import { COURSES, DIETARY } from '../../domain/tags';
import { normalizeTags } from '../../domain/types';
import type { Course, DietaryTag, Ingredient } from '../../domain/types';
import { splitIngredient } from './ingredient';
import type { ImportedRecipe } from './types';

export const MAX_INGREDIENTS = 60;
export const MAX_STEPS = 40;
export const MAX_MINUTES = 2880;
export const MAX_SERVES = 100;
export const MAX_IMPORT_TAGS = 5;
const CAP = { title: 120, story: 1500, origin: 80, occasion: 40, occasions: 8, makes: 60, quantity: 40, item: 140, step: 600, note: 200 };

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function text(v: unknown, max: number): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t.slice(0, max).trim();
}

/** Validate and clamp anything that came from Claude or from a page's JSON-LD. Never throws. */
export function normalizeImported(raw: unknown): ImportedRecipe {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const r: Record<string, unknown> = { ...(raw as object) }; // own keys only
  const out: ImportedRecipe = {};

  const title = text(r.title, CAP.title);
  if (title) out.title = title;
  const story = text(r.story, CAP.story);
  if (story) out.story = story;
  const origin = text(r.origin, CAP.origin);
  if (origin) out.origin = origin;
  const makes = text(r.makes, CAP.makes);
  if (makes) out.makes = makes;
  const note = text(r.sourceNote, CAP.note);
  if (note) out.sourceNote = note;

  if (Array.isArray(r.occasions)) {
    const occ = r.occasions.map((o) => text(o, CAP.occasion)).filter((o): o is string => !!o).slice(0, CAP.occasions);
    if (occ.length) out.occasions = occ;
  }

  if (typeof r.course === 'string') {
    const c = r.course.trim().toLowerCase();
    if (has(COURSES, c)) out.course = c as Course;
  }

  if (Array.isArray(r.dietary)) {
    const tags: DietaryTag[] = [];
    for (const d of r.dietary) {
      const k = typeof d === 'string' ? d.trim().toLowerCase() : '';
      if (has(DIETARY, k) && !tags.includes(k as DietaryTag)) tags.push(k as DietaryTag);
    }
    if (tags.length) out.dietary = tags;
  }

  if (Array.isArray(r.tags)) {
    const tags = normalizeTags(r.tags.filter((t): t is string => typeof t === 'string')).slice(0, MAX_IMPORT_TAGS);
    if (tags.length) out.tags = tags;
  }

  const sv = typeof r.serves === 'string' ? Number(r.serves.trim()) : r.serves;
  if (typeof sv === 'number' && Number.isInteger(sv) && sv >= 1 && sv <= MAX_SERVES) out.serves = sv;

  const mins = typeof r.totalMinutes === 'string' ? Number(r.totalMinutes.trim()) : r.totalMinutes;
  if (typeof mins === 'number' && Number.isFinite(mins)) {
    const m = Math.round(mins);
    if (m >= 1 && m <= MAX_MINUTES) out.totalMinutes = m;
  }

  if (Array.isArray(r.ingredients)) {
    const list: Ingredient[] = [];
    for (const i of r.ingredients) {
      if (list.length >= MAX_INGREDIENTS) break;
      let quantity: string | undefined;
      let item: string | undefined;
      if (typeof i === 'string') {
        const s = splitIngredient(i);
        quantity = s.quantity;
        item = s.item;
      } else if (typeof i === 'object' && i !== null) {
        quantity = text((i as Record<string, unknown>).quantity, CAP.quantity);
        item = text((i as Record<string, unknown>).item, CAP.item);
      }
      if (item) list.push({ quantity: (quantity ?? '').slice(0, CAP.quantity), item: item.slice(0, CAP.item) });
    }
    if (list.length) out.ingredients = list;
  }

  if (Array.isArray(r.steps)) {
    const list: string[] = [];
    for (const s of r.steps) {
      if (list.length >= MAX_STEPS) break;
      const t = text(typeof s === 'object' && s !== null ? (s as Record<string, unknown>).text : s, CAP.step);
      if (t) list.push(t);
    }
    if (list.length) out.steps = list;
  }
  return out;
}
