/** Recognising HEIC/HEIF and the other accepted photo types. Pure helpers plus one byte reader. */

const HEIC_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);
const PLAIN_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** How many leading bytes the detectors need (ISO-BMFF ftyp box header; RIFF/WEBP; PNG signature). */
export const HEAD_BYTES = 16;

export interface FileFacts {
  type?: string;
  name?: string;
  /** Leading bytes of the file, if they were read. */
  head?: Uint8Array;
}

const ascii = (b: Uint8Array, from: number, len: number): string =>
  b.length < from + len ? '' : String.fromCharCode(...b.subarray(from, from + len));

const typeOf = (f: FileFacts): string => (f.type ?? '').trim().toLowerCase();
const nameOf = (f: FileFacts): string => (f.name ?? '').trim().toLowerCase();
const typeIsBlank = (t: string): boolean => t === '' || t === 'application/octet-stream';

/** True if the leading bytes are an ISO-BMFF `ftyp` box whose major brand is a HEIC/HEIF one. */
export function hasHeicSignature(head: Uint8Array | undefined): boolean {
  return !!head && ascii(head, 4, 4) === 'ftyp' && HEIC_BRANDS.has(ascii(head, 8, 4));
}

/** HEIC/HEIF by MIME type, by file name (only when the type is blank), or by content. */
export function looksLikeHeic(f: FileFacts): boolean {
  const t = typeOf(f);
  if (HEIC_TYPES.has(t)) return true;
  if (typeIsBlank(t) && /\.(heic|heif)$/.test(nameOf(f))) return true;
  return hasHeicSignature(f.head);
}

/** JPEG, PNG, WebP or GIF by leading bytes. */
export function sniffPlainImage(head: Uint8Array | undefined): boolean {
  if (!head) return false;
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true;
  if (head.length >= 8 && head[0] === 0x89 && ascii(head, 1, 3) === 'PNG') return true;
  if (ascii(head, 0, 4) === 'GIF8') return true;
  return ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP';
}

/** A type we can handle: JPEG, PNG, WebP, GIF, or HEIC/HEIF. A blank type is judged by content. */
export function isAcceptedPhoto(f: FileFacts): boolean {
  if (looksLikeHeic(f)) return true;
  const t = typeOf(f);
  if (PLAIN_TYPES.has(t)) return true;
  return typeIsBlank(t) && sniffPlainImage(f.head);
}

async function readHead(blob: Blob): Promise<Uint8Array | undefined> {
  try {
    const part = blob.slice(0, HEAD_BYTES);
    if (typeof part.arrayBuffer === 'function') return new Uint8Array(await part.arrayBuffer());
    return await new Promise<Uint8Array | undefined>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
      r.onerror = () => resolve(undefined);
      r.readAsArrayBuffer(part);
    });
  } catch {
    return undefined;
  }
}

/** Gather type, name and leading bytes of a picked file. */
export async function factsOf(file: Blob): Promise<FileFacts> {
  return { type: file.type, name: (file as { name?: string }).name, head: await readHead(file) };
}
