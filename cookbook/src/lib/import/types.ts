import type { Course, DietaryTag, Ingredient } from '../../domain/types';

/** What an importer can fill in. Every field is optional: only what the source actually says. */
export interface ImportedRecipe {
  title?: string;
  story?: string;
  origin?: string;
  occasions?: string[];
  course?: Course;
  dietary?: DietaryTag[];
  /** Up to MAX_IMPORT_TAGS suggested search keywords. Only Claude suggests them; the local parser never does. */
  tags?: string[];
  /** Portions, a whole number from 1 to 100, only when the source states a number. */
  serves?: number;
  makes?: string;
  totalMinutes?: number;
  ingredients?: Ingredient[];
  steps?: string[];
  sourceNote?: string;
}

/** The slice of the `sample` capability the importer uses (see the runtime contract). */
export interface SampleOptionsLike {
  signal?: AbortSignal;
  images?: Blob | Blob[];
}
export interface SampleLimitsLike {
  maxPromptBytes: number;
  images?: { maxCount: number; maxInputBytes: number; mediaTypes: string[] };
}
export interface SampleFn {
  json<T = unknown>(input: string, options?: SampleOptionsLike): Promise<T>;
  limits(): Promise<SampleLimitsLike>;
}

export type ImportErrorCode =
  | 'empty'
  | 'aborted'
  | 'photo_needs_claude'
  | 'photo_failed'
  | 'images_unavailable'
  | 'image_rejected'
  | 'no_recipe_found';

/** A failure with a code the screen turns into a plain sentence. */
export class ImportError extends Error {
  readonly code: ImportErrorCode;
  constructor(code: ImportErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ImportError';
    this.code = code;
  }
}

export type ImportedBy = 'claude' | 'local';
