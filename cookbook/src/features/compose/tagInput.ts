import { MAX_TAGS, normalizeTag, TAG_MAX_LENGTH } from '../../domain/types';

export const TAG_HINT = 'Words people might search for, like noodles or soup';
export const TAG_TOO_LONG = `Keep each keyword to ${TAG_MAX_LENGTH} characters or fewer.`;
export const TAG_TOO_MANY = `You can add up to ${MAX_TAGS} keywords. Remove one to add another.`;

export interface AddTagsResult {
  /** The keyword list after adding (stored form, no duplicates, at most MAX_TAGS). */
  tags: string[];
  /** Pieces that could not be added, joined with ", ", to leave in the box so nothing typed is lost. */
  leftover: string;
  /** A plain-text reason when something was left over; otherwise undefined. */
  error?: string;
}

/**
 * Add the keywords in `text` (separated by commas or line breaks) to `current`.
 * Empty pieces and ones already present are skipped silently; over-long pieces and pieces past the
 * limit are returned in `leftover` with an `error` message.
 */
export function addTags(current: readonly string[], text: string): AddTagsResult {
  const tags = [...current];
  const left: string[] = [];
  let error: string | undefined;
  for (const piece of text.split(/[,\n\r]/)) {
    const t = normalizeTag(piece);
    if (t.length === 0 || tags.includes(t)) continue;
    if (t.length > TAG_MAX_LENGTH) {
      left.push(piece.trim());
      error = error ?? TAG_TOO_LONG;
    } else if (tags.length >= MAX_TAGS) {
      left.push(piece.trim());
      error = TAG_TOO_MANY;
    } else {
      tags.push(t);
    }
  }
  return { tags, leftover: left.join(', '), ...(error ? { error } : {}) };
}
