import { describe, expect, it } from 'vitest';
// The test runner blanks CSS imports, so read the token file's text from disk (tests run from cookbook/).
// @ts-ignore node types are not installed for the browser build; this runs under vitest only.
import { readFileSync } from 'node:fs';
import { COURSES, DIETARY } from './tags';

const tokensCss: string = readFileSync('src/styles/tokens.css', 'utf8');

/** Reads `--name: #rrggbb` from the token file text. */
function token(name: string): string {
  const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(tokensCss);
  if (!m) throw new Error(`token ${name} is not a hex colour in tokens.css`);
  return m[1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio. */
export function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const stocks = ['canary', 'blush', 'mint', 'sky'].map((s) => [`stock-${s}`, token(`--stock-${s}`)] as const);
const grounds = [['card', token('--card')], ['paper-white', token('--paper-white')], ...stocks] as const;

describe('ratio helper', () => {
  it('matches the known WCAG extremes (catches a broken luminance formula)', () => {
    expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(ratio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});

describe.each([['--margin-ink'], ['--ink'], ['--ink-soft']])('%s', (name) => {
  it.each(grounds)('is at least 4.5:1 on %s (catches text too faint to read)', (_g, bg) => {
    expect(ratio(token(name), bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('dietary stamp inks', () => {
  it.each(Object.entries(DIETARY))('%s ink is at least 4.5:1 on the card and every stock', (_tag, info) => {
    const ink = token(`--stamp-${info.ink}`);
    for (const [, bg] of grounds) expect(ratio(ink, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('course stock', () => {
  it('every stock token a course points at exists (catches a typo in a stock name)', () => {
    for (const info of Object.values(COURSES)) expect(token(`--stock-${info.stock}`)).toMatch(/^#/);
  });
  it('the blue rules stay visible on each stock (catches a stock too close to the rule colour)', () => {
    for (const [, bg] of stocks) expect(ratio(token('--rule'), bg)).toBeGreaterThanOrEqual(1.3);
  });
});

describe('tin ground', () => {
  const tin = [['--tin', token('--tin')], ['--tin-hi', token('--tin-hi')], ['--tin-lo', token('--tin-lo')]] as const;
  it.each(tin)('card-coloured text (header, notice, tab labels, focus ring) is at least 4.5:1 on %s (catches a tin too light for card text)', (_n, bg) => {
    expect(ratio(token('--card'), bg)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(tin)('kraft (tab fills, chip and panel borders) is at least 3:1 UI contrast on %s (catches a tin too light for kraft edges)', (_n, bg) => {
    expect(ratio(token('--kraft'), bg)).toBeGreaterThanOrEqual(3);
  });
  it('kraft text on the filter panel and header (--tin-lo) is at least 4.5:1 (catches a panel too light for kraft text)', () => {
    expect(ratio(token('--kraft'), token('--tin-lo'))).toBeGreaterThanOrEqual(4.5);
  });
  it('the card-coloured focus ring is at least 3:1 on the lightest and darkest gradient stops (catches an invisible focus ring)', () => {
    expect(ratio(token('--card'), token('--tin-hi'))).toBeGreaterThanOrEqual(3);
    expect(ratio(token('--card'), token('--tin-lo'))).toBeGreaterThanOrEqual(3);
  });
  it('the gradient runs from --tin-hi to --tin-lo (catches the page ground drifting from the tin tokens)', () => {
    expect(tokensCss).toMatch(/--ground:\s*radial-gradient\([^)]*var\(--tin-hi\)[^)]*var\(--tin-lo\)/);
  });
  it('no enamel token remains (catches a stale teal ground)', () => {
    expect(tokensCss).not.toMatch(/--enamel/);
  });
});

describe('tokens file hygiene', () => {
  it('--margin-ink differs from --margin, which stays for rules (catches the text red replacing the rule red)', () => {
    expect(token('--margin-ink')).not.toBe(token('--margin'));
  });
});
