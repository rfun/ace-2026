export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
/** Files at or under this size and within the edge limit are uploaded untouched. */
export const SMALL_ENOUGH_BYTES = 1.5 * 1024 * 1024;
const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.85;

export class ImageTooLargeError extends Error {
  constructor(message = 'That photo is larger than 20 MB. Choose a smaller one.') {
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

/**
 * Downscale so the longest edge is at most maxEdge (default 1600) and re-encode as JPEG (quality 0.85).
 * Returns the original blob if it is already small enough and within maxEdge, or if decoding is unsupported.
 * Throws ImageTooLargeError if the input is over MAX_UPLOAD_BYTES.
 */
export async function resizeImage(file: Blob, opts: { maxEdge?: number; quality?: number } = {}): Promise<Blob> {
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageTooLargeError();
  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = opts.quality ?? DEFAULT_QUALITY;
  const img = await backend.decode(file);
  if (!img) return file;
  try {
    const target = fitWithin(img.width, img.height, maxEdge);
    const scaled = target.width !== img.width || target.height !== img.height;
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
