/**
 * Scale the leading amount of a free-text ingredient quantity ("1 1/2 cups", "2-3 tbsp", "2 (400g) cans").
 * Pure: no React, no storage. Units and words are kept exactly as written; only the first number or range moves.
 */

export interface ScaledQuantity {
  /** The text to show. Byte-identical to the input when nothing changed. */
  text: string;
  /** True when the text starts with a number (or range) that was understood. */
  scaled: boolean;
}

const VULGAR: Record<string, number> = {
  '½': 1 / 2, '¼': 1 / 4, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3,
  '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5, '⅙': 1 / 6, '⅚': 5 / 6,
  '⅐': 1 / 7, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8, '⅑': 1 / 9, '⅒': 1 / 10,
};
const V = '[' + Object.keys(VULGAR).join('') + ']';

// One amount. Order matters: the longer shapes (mixed numbers) must be tried before the plain integer.
const NUM = `(?:\\d+\\s*${V}|\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d*\\.\\d+|\\d+|${V})`;
const LEAD = new RegExp(`^(\\s*)(${NUM})(?:(\\s*[-\\u2013\\u2014]\\s*|\\s+to\\s+)(${NUM}))?`);

interface Amount { value: number; decimal: boolean }

function parseAmount(token: string): Amount | null {
  const t = token.trim();
  const mixedVulgar = new RegExp(`^(\\d+)\\s*(${V})$`).exec(t);
  if (mixedVulgar) return { value: Number(mixedVulgar[1]) + VULGAR[mixedVulgar[2]], decimal: false };
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (mixed) return Number(mixed[3]) === 0 ? null : { value: Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]), decimal: false };
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac) return Number(frac[2]) === 0 ? null : { value: Number(frac[1]) / Number(frac[2]), decimal: false };
  if (t in VULGAR) return { value: VULGAR[t], decimal: false };
  if (/^\d*\.\d+$/.test(t)) return { value: Number(t), decimal: true };
  if (/^\d+$/.test(t)) return { value: Number(t), decimal: false };
  return null;
}

const GLYPH: Array<[number, string]> = [
  [0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [1, ''],
];

/** Whole numbers plain; otherwise the nearest of 1/8 1/4 1/3 1/2 2/3 3/4 as a glyph. Never "0". */
function formatFraction(v: number): string {
  let whole = Math.floor(v + 1e-9);
  const rest = Math.max(0, v - whole);
  let best = GLYPH[0];
  for (const g of GLYPH) if (Math.abs(g[0] - rest) < Math.abs(best[0] - rest)) best = g;
  if (best[0] === 1) {
    whole += 1;
    best = GLYPH[0];
  }
  if (whole === 0 && best[1] === '') return '⅛'; // would have been 0: show the smallest fraction
  return (whole > 0 ? String(whole) : '') + best[1];
}

/** At most 2 decimal places, trailing zeros trimmed. A result that would round to 0 shows 0.01. */
function formatDecimal(v: number): string {
  const r = Math.max(0.01, Math.round(v * 100 + 1e-9) / 100);
  return String(Number(r.toFixed(2)));
}

export function scaleQuantity(text: string, factor: number): ScaledQuantity {
  const m = LEAD.exec(text);
  if (!m) return { text, scaled: false };
  const lo = parseAmount(m[2]);
  let hi = m[4] === undefined ? null : parseAmount(m[4]);
  if (!lo || lo.value <= 0) return { text, scaled: false };
  // "2-3/4" is not a range from 2 to 3/4: when the second end is not larger, only the first number counts.
  let consumed = m[0].length;
  if (hi && hi.value <= lo.value) {
    consumed = m[1].length + m[2].length;
    hi = null;
  }
  if (!Number.isFinite(factor) || factor <= 0) return { text, scaled: false };
  if (factor === 1) return { text, scaled: true };

  const decimal = lo.decimal || (hi?.decimal ?? false);
  const fmt = (v: number) => (decimal ? formatDecimal(v) : formatFraction(v));
  const body = hi ? `${fmt(lo.value * factor)}${m[3]}${fmt(hi.value * factor)}` : fmt(lo.value * factor);
  return { text: m[1] + body + text.slice(consumed), scaled: true };
}
