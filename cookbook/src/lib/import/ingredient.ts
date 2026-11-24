import type { Ingredient } from '../../domain/types';

const FRAC = '[\\u00BC-\\u00BE\\u2150-\\u215E]';
const NUM = '\\d+(?:[.,]\\d+)?(?:/\\d+)?';
const ONE = `(?:\\d+\\s*${FRAC}|\\d+\\s+\\d+/\\d+|${NUM}|${FRAC})`;
const QTY = `${ONE}(?:\\s*[-\\u2013]\\s*${ONE})?`;
const UNIT =
  '(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?|gm|gms|g|grams?|kg|kilograms?|ml|millilitres?|milliliters?|l|litres?|liters?|oz|ounces?|lbs?|pounds?|pinch(?:es)?|dash(?:es)?|cloves?|cans?|sticks?|bunch(?:es)?|sprigs?|slices?|pieces?)';
const QTY_RE = new RegExp(`^(${QTY})(?:\\s*(${UNIT})(?![A-Za-z]))?\\s*(.*)$`, 'i');

/** Split "1 ½ cups flour" into quantity "1 ½ cups" and item "flour". A line with no leading amount is all item. */
export function splitIngredient(line: string): Ingredient {
  const s = line.trim().replace(/\s+/g, ' ');
  const m = QTY_RE.exec(s);
  if (!m) return { quantity: '', item: s };
  const rest = m[3].replace(/^(?:of\s+)/i, '').replace(/^[,;:\-–]\s*/, '').trim();
  if (rest === '') return { quantity: '', item: s };
  return { quantity: m[2] ? `${m[1].trim()} ${m[2]}` : m[1].trim(), item: rest };
}
