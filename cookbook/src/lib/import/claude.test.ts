import { describe, expect, it, vi } from 'vitest';
import { parseWithClaude, truncateToBytes } from './claude';
import { importRecipe } from './index';
import { ImportError } from './types';
import type { SampleFn, SampleLimitsLike } from './types';

const IMG_LIMITS: SampleLimitsLike = {
  maxPromptBytes: 262144,
  images: { maxCount: 1, maxInputBytes: 5_000_000, mediaTypes: ['image/jpeg', 'image/png'] },
};

function fake(json: (input: string, opts?: unknown) => Promise<unknown>, limits: SampleLimitsLike = IMG_LIMITS) {
  const s = { json: vi.fn(json), limits: vi.fn(async () => limits) };
  return s as unknown as SampleFn & typeof s;
}
const png = () => new Blob(['x'], { type: 'image/png' });

describe('parseWithClaude', () => {
  it('sends a prompt with every allowed course and dietary key and the source text (catches a prompt missing the keys or text)', async () => {
    const s = fake(async () => ({ title: 'Dal' }));
    await parseWithClaude(s, { text: 'Dal recipe: boil lentils' });
    const prompt = s.json.mock.calls[0][0] as string;
    for (const k of ['breakfast', 'snack', 'main', 'side', 'dessert', 'sweets', 'drink', 'condiment']) expect(prompt).toContain(k);
    for (const k of ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'egg-free', 'halal', 'kosher']) expect(prompt).toContain(k);
    expect(prompt).toContain('Dal recipe: boil lentils');
    expect(prompt).toMatch(/never invent/i);
  });

  it('passes no images for text-only input', async () => {
    const s = fake(async () => ({}));
    await parseWithClaude(s, { text: 'x' });
    expect(s.json.mock.calls[0][1]).not.toHaveProperty('images');
  });

  it('passes the photo as images: [blob] when given and the view can send images', async () => {
    const s = fake(async () => ({ title: 'Card' }));
    await parseWithClaude(s, { image: png() });
    const opts = s.json.mock.calls[0][1] as { images: Blob[] };
    expect(opts.images).toHaveLength(1);
    expect(opts.images[0]).toBeInstanceOf(Blob);
    expect(s.json.mock.calls[0][0]).toMatch(/photo/i);
  });

  it('rejects images_unavailable without calling Claude when limits() reports no images', async () => {
    const s = fake(async () => ({}), { maxPromptBytes: 262144 });
    await expect(parseWithClaude(s, { image: png() })).rejects.toMatchObject({ code: 'images_unavailable' });
    expect(s.json).not.toHaveBeenCalled();
  });

  it('rejects a photo of a type the view does not accept', async () => {
    const s = fake(async () => ({}));
    await expect(parseWithClaude(s, { image: new Blob(['x'], { type: 'image/heic' }) })).rejects.toMatchObject({ code: 'image_rejected' });
    expect(s.json).not.toHaveBeenCalled();
  });

  it('truncates the text to the reported input cap', async () => {
    const s = fake(async () => ({}), { maxPromptBytes: 3000 });
    await parseWithClaude(s, { text: 'a'.repeat(10_000) });
    const prompt = s.json.mock.calls[0][0] as string;
    expect(new TextEncoder().encode(prompt).length).toBeLessThanOrEqual(3000);
    expect(prompt).toContain('aaaa');
  });

  it('runs the answer through normalizeImported (unknown course dropped, caps applied)', async () => {
    const s = fake(async () => ({ title: 'T', course: 'brunch', dietary: ['vegan', 'paleo'], totalMinutes: 99999, steps: Array(80).fill('go') }));
    const r = await parseWithClaude(s, { text: 'x' });
    expect(r).toEqual({ title: 'T', dietary: ['vegan'], steps: Array(40).fill('go') });
  });

  it('propagates a rejection from sample.json unchanged', async () => {
    const err = { code: 'not_granted', message: 'no' };
    const s = fake(async () => Promise.reject(err));
    await expect(parseWithClaude(s, { text: 'x' })).rejects.toBe(err);
  });

  it('hands the abort signal to sample.json', async () => {
    const s = fake(async () => ({}));
    const ac = new AbortController();
    await parseWithClaude(s, { text: 'x', signal: ac.signal });
    expect((s.json.mock.calls[0][1] as { signal: AbortSignal }).signal).toBe(ac.signal);
  });
});

describe('truncateToBytes', () => {
  it('does not split a multi-byte character', () => {
    const out = truncateToBytes('ab½½', 3); // a b + first byte of a 2-byte char
    expect(out).toBe('ab');
  });
  it('leaves no trailing replacement char and stays within the limit when cutting an emoji or e-acute', () => {
    const bad = String.fromCharCode(0xfffd);
    for (const [text, limit, want] of [
      ['ab\u{1F600}', 4, 'ab'], // emoji is 4 bytes; cut after 2 of them
      ['ab\u{1F600}', 5, 'ab'],
      ['abc\u00e9', 4, 'abc'], // e-acute is 2 bytes; cut after 1
      ['abc\u00e9', 5, 'abc\u00e9'],
    ] as const) {
      const out = truncateToBytes(text, limit);
      expect(out).toBe(want);
      expect(out.includes(bad)).toBe(false);
      expect(new TextEncoder().encode(out).length).toBeLessThanOrEqual(limit);
    }
  });
  it('returns everything when it fits and nothing for a zero budget', () => {
    expect(truncateToBytes('abc', 10)).toBe('abc');
    expect(truncateToBytes('abc', 0)).toBe('');
  });
});

describe('importRecipe strategy', () => {
  const NOTES = 'Chai\nIngredients\n1 cup milk\nMethod\nBoil.';
  it('uses Claude first when sample is there', async () => {
    const s = fake(async () => ({ title: 'From Claude', steps: ['x'] }));
    const r = await importRecipe({ sample: s, text: NOTES });
    expect(r.by).toBe('claude');
    expect(r.recipe.title).toBe('From Claude');
  });
  it.each([
    ['not_granted'],
    ['rate_limited'],
    ['invalid_json'],
  ])('falls back to the local reader on %s', async (code) => {
    const s = fake(async () => Promise.reject({ code, message: 'm' }));
    const r = await importRecipe({ sample: s, text: NOTES });
    expect(r.by).toBe('local');
    expect(r.recipe.title).toBe('Chai');
  });
  it('falls back on an arbitrary thrown error', async () => {
    const s = fake(async () => Promise.reject(new Error('boom')));
    expect((await importRecipe({ sample: s, text: NOTES })).by).toBe('local');
  });
  it('falls back when Claude returns nothing usable', async () => {
    const s = fake(async () => ({ course: 'brunch' }));
    expect((await importRecipe({ sample: s, text: NOTES })).by).toBe('local');
  });
  it('uses the local reader when there is no sample', async () => {
    const r = await importRecipe({ sample: null, text: NOTES });
    expect(r.by).toBe('local');
  });
  it('a photo alone without sample is photo_needs_claude', async () => {
    await expect(importRecipe({ sample: null, image: png() })).rejects.toMatchObject({ code: 'photo_needs_claude' });
  });
  it('a photo alone when Claude fails is photo_failed, never a fake local result', async () => {
    const s = fake(async () => Promise.reject({ code: 'rate_limited' }));
    await expect(importRecipe({ sample: s, image: png() })).rejects.toMatchObject({ code: 'photo_failed' });
  });
  it('a photo alone when the view cannot send images keeps its own code', async () => {
    const s = fake(async () => ({}), { maxPromptBytes: 1000 });
    await expect(importRecipe({ sample: s, image: png() })).rejects.toMatchObject({ code: 'images_unavailable' });
  });
  it('empty input is "empty"', async () => {
    await expect(importRecipe({ sample: null, text: '   ' })).rejects.toBeInstanceOf(ImportError);
    await expect(importRecipe({ sample: null, text: '   ' })).rejects.toMatchObject({ code: 'empty' });
  });
  it('an abort is reported as aborted and does not fall back to the local reader', async () => {
    const ac = new AbortController();
    const s = fake(
      (_i, o) =>
        new Promise((_, reject) => {
          (o as { signal: AbortSignal }).signal.addEventListener('abort', () => reject({ code: 'aborted' }));
        }),
    );
    const p = importRecipe({ sample: s, text: NOTES, signal: ac.signal });
    await vi.waitFor(() => expect(s.json).toHaveBeenCalled());
    ac.abort();
    await expect(p).rejects.toMatchObject({ code: 'aborted' });
  });
});
