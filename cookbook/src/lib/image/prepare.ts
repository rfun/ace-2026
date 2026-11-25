import { factsOf, isAcceptedPhoto, looksLikeHeic, hasHeicSignature } from './detect';
import { HeicConversionError, UnreadableImageError, UnsupportedImageError } from './errors';
import { loadHeicConverter } from './heic';
import { decodeNative, ImageTooLargeError, MAX_UPLOAD_BYTES, shrinkDecoded } from './resize';

export interface PrepareOptions { maxEdge?: number; quality?: number }

/**
 * Turn a picked file into the JPEG/PNG/WebP/GIF blob to upload, or throw a typed error:
 *   ImageTooLargeError (over 20 MB), UnsupportedImageError (not a photo type we take),
 *   UnreadableImageError (a non-HEIC file the browser cannot decode),
 *   HeicConversionError (HEIC that neither the browser nor the converter could turn into a JPEG).
 * A HEIC/HEIF file is NEVER returned as is: it always leaves as a re-encoded JPEG.
 */
export async function preparePhoto(file: Blob, opts: PrepareOptions = {}): Promise<Blob> {
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageTooLargeError();
  const facts = await factsOf(file);
  if (!isAcceptedPhoto(facts)) throw new UnsupportedImageError();
  const heic = looksLikeHeic(facts);

  const img = await decodeNative(file);
  if (img) {
    const out = await shrinkDecoded(file, img, { ...opts, forceEncode: heic });
    if (!out) throw new HeicConversionError();
    return out;
  }
  if (!heic) throw new UnreadableImageError();

  // The browser cannot read this HEIC (everything except Safari): convert it, then the usual resize.
  let jpeg: Blob;
  try {
    jpeg = await (await loadHeicConverter()).convert(file);
  } catch {
    throw new HeicConversionError();
  }
  if (hasHeicSignature((await factsOf(jpeg)).head)) throw new HeicConversionError();
  const converted = await decodeNative(jpeg);
  if (!converted) throw new HeicConversionError();
  const out = await shrinkDecoded(jpeg, converted, opts);
  if (!out) throw new HeicConversionError();
  return out;
}
