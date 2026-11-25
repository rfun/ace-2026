// Test helpers only (never imported by the app, so never bundled).
import { setImageBackend, type ImageBackend } from './resize';

/** jsdom has no canvas or createImageBitmap: a backend that "decodes" any file as a small image and passes it through. */
export const smallImageBackend: ImageBackend = {
  decode: async () => ({ width: 100, height: 100, source: {} }),
  encode: async () => new Blob(['jpeg'], { type: 'image/jpeg' }),
};

export function installSmallImageBackend(): void {
  setImageBackend(smallImageBackend);
}

export function resetImageBackend(): void {
  setImageBackend(null);
}
