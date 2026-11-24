import { parseWithClaude } from './claude';
import { parseRecipeText } from './parseText';
import { ImportError } from './types';
import type { ImportedBy, ImportedRecipe, SampleFn } from './types';

export { parseWithClaude } from './claude';
export { normalizeImported } from './normalize';
export { parseRecipeText } from './parseText';
export { ImportError } from './types';
export type { ImportedBy, ImportedRecipe, SampleFn } from './types';

export const hasContent = (r: ImportedRecipe): boolean => !!(r.title || r.ingredients?.length || r.steps?.length);

/**
 * The import strategy: Claude first when the `sample` capability is there, the local reader otherwise or on any
 * Claude failure (text only). A photo alone needs Claude. An abort is never turned into a fallback.
 */
export async function importRecipe(opts: {
  sample: SampleFn | null;
  text?: string;
  image?: Blob;
  signal?: AbortSignal;
}): Promise<{ recipe: ImportedRecipe; by: ImportedBy }> {
  const text = opts.text?.trim() ?? '';
  if (text === '' && !opts.image) throw new ImportError('empty');
  const local = () => {
    const recipe = parseRecipeText(text);
    if (!hasContent(recipe)) throw new ImportError('no_recipe_found');
    return { recipe, by: 'local' as const };
  };

  if (!opts.sample) {
    if (text === '') throw new ImportError('photo_needs_claude');
    return local();
  }

  try {
    const recipe = await parseWithClaude(opts.sample, { text, image: opts.image, signal: opts.signal });
    if (hasContent(recipe)) return { recipe, by: 'claude' };
  } catch (err) {
    if (opts.signal?.aborted) throw new ImportError('aborted');
    if (text === '') {
      if (err instanceof ImportError) throw err;
      const code = (err as { code?: unknown } | null)?.code;
      if (code === 'images_unavailable' || code === 'image_rejected') throw new ImportError(code);
      if (err instanceof Error && err.name === 'ImageTooLargeError') throw err;
      throw new ImportError('photo_failed');
    }
  }
  if (opts.signal?.aborted) throw new ImportError('aborted');
  if (text === '') throw new ImportError('no_recipe_found');
  return local();
}
