import { COURSES, DIETARY } from '../../domain/tags';
import { resizeImage } from '../image/resize';
import { normalizeImported } from './normalize';
import { ImportError } from './types';
import type { ImportedRecipe, SampleFn } from './types';

/** The fixed instructions. The pasted text, if any, is appended after them. */
export function buildPrompt(opts: { hasText: boolean; hasImage: boolean }): string {
  const courses = Object.keys(COURSES).join(', ');
  const dietary = Object.keys(DIETARY).join(', ');
  const where =
    opts.hasText && opts.hasImage
      ? 'The recipe is in the pasted text below and in the attached photo of a recipe card.'
      : opts.hasImage
        ? 'The recipe is in the attached photo of a recipe card.'
        : 'The recipe is in the pasted text below. It may be copied from a web page, so ignore menus, ads and comments.';
  return [
    'You are helping a member of a community cookbook fill in a recipe form. ' + where,
    'Reply with only one JSON object and nothing else. Use exactly these keys, and leave out any key the source does not support:',
    '{ "title": string, "story": string, "origin": string, "occasions": string[], "course": string, "dietary": string[], "makes": string, "totalMinutes": integer, "ingredients": [{ "quantity": string, "item": string }], "steps": string[], "sourceNote": string }',
    'Rules:',
    '- Copy only what the source says. Never invent quantities, times, steps or a story.',
    '- "story" only if the source has its own description or introduction; otherwise leave it out.',
    '- "origin" is a culture or region, only if the source names one.',
    `- "course" must be one of: ${courses}. Leave it out unless it is clear.`,
    `- "dietary" may only contain: ${dietary}. Include a tag only if the source states it or the ingredients make it unambiguous.`,
    '- "makes" is the yield, for example "Serves 4" or "24 ladoos". "totalMinutes" is the total time in whole minutes.',
    '- "quantity" is the amount with its unit (for example "1 1/2 cups"); "item" is the ingredient. Keep one ingredient per entry and one instruction per step, in the original order.',
    '- "sourceNote" is a short credit or caveat from the source, such as "Adapted from my aunt\'s notebook", only if present.',
  ].join('\n');
}

const encoder = typeof TextEncoder === 'function' ? new TextEncoder() : undefined;
const decoder = typeof TextDecoder === 'function' ? new TextDecoder() : undefined;

/** Cut text to at most `maxBytes` of UTF-8 without leaving half a character at the end. */
export function truncateToBytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return '';
  if (!encoder || !decoder) return text.slice(0, Math.floor(maxBytes / 4));
  const bytes = encoder.encode(text);
  if (bytes.length <= maxBytes) return text;
  return decoder.decode(bytes.slice(0, maxBytes)).replace(/\uFFFD+$/, '');
}

/** Ask Claude (the `sample` capability) to read pasted text and/or a photo. Rejects with whatever sample rejects with. */
export async function parseWithClaude(
  sample: SampleFn,
  input: { text?: string; image?: Blob; signal?: AbortSignal },
): Promise<ImportedRecipe> {
  const text = input.text?.trim() ?? '';
  const limits = await sample.limits();

  let images: Blob[] | undefined;
  if (input.image) {
    const cap = limits.images;
    if (!cap || cap.maxCount < 1) throw new ImportError('images_unavailable');
    const small = await resizeImage(input.image);
    if (small.size > cap.maxInputBytes || (cap.mediaTypes.length > 0 && !cap.mediaTypes.includes(small.type))) {
      throw new ImportError('image_rejected');
    }
    images = [small];
  }

  const prompt = buildPrompt({ hasText: text !== '', hasImage: images !== undefined });
  let full = prompt;
  if (text !== '') {
    const budget = limits.maxPromptBytes - (encoder ? encoder.encode(prompt).length : prompt.length * 4) - 64;
    full = `${prompt}\n\nPasted text:\n"""\n${truncateToBytes(text, budget)}\n"""`;
  }
  const raw = await sample.json<unknown>(full, {
    ...(images ? { images } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  });
  return normalizeImported(raw);
}
