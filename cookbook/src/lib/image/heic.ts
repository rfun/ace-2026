/**
 * Lazy HEIC converter. The heic-to library (with libheif inside) is about 3 MB, so it is NOT part of the
 * page bundle: it is a separate file next to index.html, fetched with a dynamic import only the first time a
 * HEIC photo cannot be decoded by the browser itself, and cached for the rest of the page load.
 */

export interface HeicConverter {
  /** Convert a HEIC/HEIF blob to a JPEG blob. */
  convert(file: Blob): Promise<Blob>;
}

/** File name of the converter, published beside index.html (see vite.config.ts and README "Publishing"). */
export const CONVERTER_FILE = 'heic-to.js';
const CONVERT_QUALITY = 0.9;

type HeicToModule = {
  heicTo(args: { blob: Blob; type: 'image/jpeg'; quality?: number }): Promise<Blob>;
};

async function loadFromPage(): Promise<HeicConverter> {
  // Relative to the page, not to the bundle; @vite-ignore keeps the bundler from trying to resolve it.
  const url = new URL('./' + CONVERTER_FILE, document.baseURI).href;
  const mod = (await import(/* @vite-ignore */ url)) as HeicToModule;
  if (typeof mod.heicTo !== 'function') throw new Error('heic converter has no heicTo export');
  return { convert: (blob) => mod.heicTo({ blob, type: 'image/jpeg', quality: CONVERT_QUALITY }) };
}

let loader: () => Promise<HeicConverter> = loadFromPage;
let cached: Promise<HeicConverter> | null = null;

/** Test seam: replace how the converter is loaded (null restores the real loader). Clears the cache. */
export function setHeicConverterLoader(next: (() => Promise<HeicConverter>) | null): void {
  loader = next ?? loadFromPage;
  cached = null;
}

/** The converter, loaded at most once per page load. A failed load is not cached, so a retry can succeed. */
export function loadHeicConverter(): Promise<HeicConverter> {
  if (!cached) {
    const p = loader();
    cached = p;
    p.catch(() => {
      if (cached === p) cached = null;
    });
  }
  return cached;
}
