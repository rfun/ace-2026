// Vite plugin: emit the HEIC converter as its own file next to index.html.
// It is heic-to's "csp" build (no unsafe-eval), copied unmodified. src/lib/image/heic.ts fetches it on demand;
// it is never part of the single-file page. Keep CONVERTER_FILE in sync with src/lib/image/heic.ts.
import { readFileSync } from 'node:fs';

export const CONVERTER_FILE = 'heic-to.js';
export const CONVERTER_SOURCE = 'node_modules/heic-to/dist/csp/heic-to.js';

export default function heicConverterFile() {
  return {
    name: 'heic-converter-file',
    apply: 'build',
    generateBundle() {
      const source = readFileSync(new URL('../' + CONVERTER_SOURCE, import.meta.url));
      this.emitFile({ type: 'asset', fileName: CONVERTER_FILE, source });
    },
  };
}
