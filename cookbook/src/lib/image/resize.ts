export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
/**
 * "Small enough" for the passthrough rule: files at or under this size and within the edge limit are
 * uploaded untouched; a heavier file is re-encoded even if its edges fit (the smaller result wins).
 */
export const SMALL_ENOUGH_BYTES = 1.5 * 1024 * 1024;
const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.85;

export class ImageTooLargeError extends Error {
  constructor(message = 'That photo is over 20 MB. Choose a smaller one.') {
    super(message);
    this.name = 'ImageTooLargeError';
  }
}

export interface Size { width: number; height: number }

/** Scale (w, h) down, keeping the ratio, so the longest edge is at most maxEdge. Never scales up. */
export function fitWithin(w: number, h: number, maxEdge: number): Size {
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export interface DecodedImage extends Size {
  source: unknown;
  close?: () => void;
}

/** The browser-only part, kept behind a seam so tests can replace it (jsdom has no canvas). */
export interface ImageBackend {
  decode(blob: Blob): Promise<DecodedImage | null>;
  encode(img: DecodedImage, size: Size, quality: number): Promise<Blob | null>;
}

const browserBackend: ImageBackend = {
  async decode(blob) {
    if (typeof createImageBitmap !== 'function') return null;
    try {
      const bmp = await createImageBitmap(blob);
      return { width: bmp.width, height: bmp.height, source: bmp, close: () => bmp.close() };
    } catch {
      return null;
    }
  },
  async encode(img, size, quality) {
    const source = img.source as CanvasImageSource;
    if (typeof OffscreenCanvas === 'function') {
      const canvas = new OffscreenCanvas(size.width, size.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.drawImage(source, 0, 0, size.width, size.height);
      return canvas.convertToBlob({ type: 'image/jpeg', quality });
    }
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(source, 0, 0, size.width, size.height);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  },
};

let backend: ImageBackend = browserBackend;

/** Test seam: swap the decode/encode backend. Pass null to restore the browser one. */
export function setImageBackend(next: ImageBackend | null): void {
  backend = next ?? browserBackend;
}

/** Decode with the browser's own decoder; null if it cannot (or cannot at all). */
export function decodeNative(blob: Blob): Promise<DecodedImage | null> {
  return backend.decode(blob);
}

/**
 * Shrink an already decoded image and re-encode as JPEG. `file` is the blob it was decoded from.
 * Normally returns `file` itself when it is already small enough; with `forceEncode` it never does
 * (used for HEIC, which must never be uploaded as is) and returns null if the encoder gave nothing.
 */
export async function shrinkDecoded(
  file: Blob,
  img: DecodedImage,
  opts: { maxEdge?: number; quality?: number; forceEncode?: boolean } = {},
): Promise<Blob | null> {
  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = opts.quality ?? DEFAULT_QUALITY;
  try {
    const target = fitWithin(img.width, img.height, maxEdge);
    const scaled = target.width !== img.width || target.height !== img.height;
    if (opts.forceEncode) return await backend.encode(img, target, quality);
    if (!scaled && file.size <= SMALL_ENOUGH_BYTES) return file;
    const out = await backend.encode(img, target, quality);
    if (!out) return file;
    // Re-encoding an unscaled photo can make it bigger; keep whichever is smaller.
    if (!scaled && out.size >= file.size) return file;
    return out;
  } finally {
    img.close?.();
  }
}

/**
 * Downscale so the longest edge is at most maxEdge (default 1600) and re-encode as JPEG (quality 0.85).
 * Returns the original blob if it is already small enough and within maxEdge, or if decoding is unsupported.
 * Throws ImageTooLargeError if the input is over MAX_UPLOAD_BYTES.
 * Photo pickers use preparePhoto (prepare.ts), which also validates the type and converts HEIC.
 */
export async function resizeImage(file: Blob, opts: { maxEdge?: number; quality?: number } = {}): Promise<Blob> {
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageTooLargeError();
  const img = await backend.decode(file);
  if (!img) return file;
  return (await shrinkDecoded(file, img, opts)) ?? file;
}
