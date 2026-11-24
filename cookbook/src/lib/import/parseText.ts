import { durationToMinutes } from './duration';
import { splitIngredient } from './ingredient';
import { recipeFromJsonLd } from './jsonld';
import { normalizeImported } from './normalize';
import type { ImportedRecipe } from './types';

const ING_HEAD = /^(?:ingredients?(?:\s+list)?|what you(?:'|’)ll need)\s*:?$/i;
const METHOD_HEAD = /^(?:method|directions?|steps?|instructions?|preparation|procedure|how to make(?: it)?)\s*:?$/i;
const STOP_HEAD =
  /^(?:notes?|recipe notes|nutrition(?: facts| information)?|comments?(?: \(\d+\))?|\d+ comments?|reviews?|leave a (?:comment|reply)|you (?:may|might) also like|related (?:recipes|posts)|tips?)\s*:?$/i;
const NOISE =
  /^(?:home|recipes?|about(?: us)?|contact|menu|search|log ?in|sign ?(?:in|up)|subscribe|newsletter|print(?: recipe)?|share|pin(?: it)?|save(?: recipe)?|rate(?: this recipe)?|jump to (?:the )?recipe|skip to (?:main )?content|advertisement|cookie.*|accept(?: all)?|privacy policy|terms.*|follow us|facebook|instagram|pinterest|twitter|youtube|email|reply|\d+ (?:comments?|reviews?|ratings?))[\s.!:]*$/i;
const BULLET = /^(?:[-*•·▪◦–▢□☐✓]+|\d+[.)])\s+/;

const clean = (line: string): string =>
  line
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/^(\*\*|__)(.*)\1$/, '$2')
    .trim();

interface Meta {
  makes?: string;
  serves?: number;
  total?: number;
  prep?: number;
  cook?: number;
}

/** "4", "4 servings", "6 people": a single whole number of portions. Ranges like "4-6" are left to the member. */
function servesNumber(v: string): number | undefined {
  const m = /^(\d{1,3})(?:\s*(?:servings?|people|persons?|portions?|adults?))?\.?$/i.exec(v.trim());
  return m ? Number(m[1]) : undefined;
}

const YIELD_RE = /^(serves|servings?|makes|yields?)\s*:?\s*(.*)$/i;
const TIME_RE = /^(prep|preparation|cook|cooking|total)\s*(?:time)?\s*:?\s*(.*)$/i;

/** Read one line (or "A | B | C" line) of header facts. `next` lets a label-only line take the following line as its value. */
function readMeta(line: string, next: string | undefined, into: Meta): { matched: boolean; usedNext: boolean } {
  let matched = false;
  let usedNext = false;
  for (const seg of line.split(/\s*[|•·]\s*/)) {
    const y = YIELD_RE.exec(seg.trim());
    if (y) {
      let v = y[2].trim();
      if (v === '' && next && next.length <= 40) {
        v = next;
        usedNext = true;
      }
      if (v !== '' && v.length <= 40) {
        const label = y[1].toLowerCase();
        if (label.startsWith('serv')) {
          into.makes = `Serves ${v}`;
          const n = servesNumber(v);
          if (n !== undefined) into.serves = n;
        }
        else into.makes = /^\d+$/.test(v) ? `Makes ${v}` : v;
        matched = true;
        continue;
      }
    }
    const t = TIME_RE.exec(seg.trim());
    if (t) {
      let v = t[2].trim();
      let viaNext = false;
      if (v === '' && next) {
        v = next;
        viaNext = true;
      }
      const mins = v === '' ? undefined : durationToMinutes(v);
      if (mins !== undefined) {
        const label = t[1].toLowerCase();
        if (label === 'total') into.total = mins;
        else if (label.startsWith('prep')) into.prep = mins;
        else into.cook = mins;
        matched = true;
        if (viaNext) usedNext = true;
      }
    }
  }
  return { matched, usedNext };
}

function minutesOf(m: Meta): number | undefined {
  if (m.total !== undefined) return m.total;
  const sum = (m.prep ?? 0) + (m.cook ?? 0);
  return sum > 0 ? sum : undefined;
}

type Section = 'head' | 'ingredients' | 'steps' | 'stop';

/**
 * Best-effort, offline reading of a pasted recipe: a JSON-LD Recipe if the text holds one, otherwise
 * headings, lists and "Serves / Prep / Cook / Total" lines. Never throws; always returns something for non-empty text.
 */
export function parseRecipeText(text: string): ImportedRecipe {
  if (typeof text !== 'string' || text.trim() === '') return {};

  const ld = recipeFromJsonLd(text);
  if (ld && (ld.ingredients || ld.steps)) return ld;

  const lines = text.split(/\r?\n/).map(clean);
  const meta: Meta = {};
  const ingredients: string[] = [];
  const steps: string[] = [];
  const intro: string[] = [];
  let title: string | undefined;
  let section: Section = 'head';
  let sawHeading = false;
  const loose: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') continue;
    if (ING_HEAD.test(line)) {
      section = 'ingredients';
      sawHeading = true;
      continue;
    }
    if (METHOD_HEAD.test(line)) {
      section = 'steps';
      sawHeading = true;
      continue;
    }
    if (STOP_HEAD.test(line) && section !== 'head') {
      section = 'stop';
      continue;
    }
    if (section === 'stop') continue;
    if (NOISE.test(line)) continue;

    if (section !== 'steps') {
      const next = lines.slice(i + 1).find((l) => l !== '');
      const r = readMeta(line, next, meta);
      if (r.matched) {
        if (r.usedNext) {
          const at = lines.indexOf(next as string, i + 1);
          if (at !== -1) lines[at] = '';
        }
        continue;
      }
    }

    const body = line.replace(BULLET, '').trim();
    if (body === '') continue;

    if (section === 'ingredients') {
      if (/:$/.test(body) && !/\d/.test(body)) continue; // sub-heading such as "For the sauce:"
      ingredients.push(body);
    } else if (section === 'steps') {
      steps.push(body.replace(/^step\s*\d+\s*[:.)-]?\s*/i, '').trim());
    } else {
      if (title === undefined && body.length <= 120) {
        title = body;
        continue;
      }
      loose.push(body);
      if (body.length >= 40) intro.push(body);
    }
  }

  const out: Record<string, unknown> = { title };
  if (sawHeading) {
    if (intro.length) out.story = intro.join('\n\n');
    out.ingredients = ingredients.map(splitIngredient);
    out.steps = steps.filter((s) => s !== '');
  } else {
    // No headings at all: keep the title and put everything else where a person can sort it out.
    out.steps = loose;
  }
  if (meta.makes) out.makes = meta.makes;
  if (meta.serves !== undefined) out.serves = meta.serves;
  const mins = minutesOf(meta);
  if (mins !== undefined) out.totalMinutes = mins;
  const result = normalizeImported(out);
  // A JSON-LD block with a name but no lists still gives a better title and facts.
  if (ld) return { ...result, ...ld };
  return result;
}
