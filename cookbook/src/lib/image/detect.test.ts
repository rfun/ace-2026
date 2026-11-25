import { describe, expect, it } from 'vitest';
import { factsOf, hasHeicSignature, isAcceptedPhoto, looksLikeHeic, sniffPlainImage } from './detect';

/** Bytes of an ISO-BMFF file header: 4-byte box size, "ftyp", then the major brand. */
const ftyp = (brand: string): Uint8Array<ArrayBuffer> => {
  const b = new Uint8Array(16);
  b.set([0, 0, 0, 0x18], 0);
  b.set([...'ftyp'].map((c) => c.charCodeAt(0)), 4);
  b.set([...brand].map((c) => c.charCodeAt(0)), 8);
  return b;
};
const bytes = (...n: number[]): Uint8Array<ArrayBuffer> => Uint8Array.from(n);
const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

describe('looksLikeHeic', () => {
  it.each(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence', 'IMAGE/HEIC'])(
    'is true for MIME type %s (catches a missed HEIC type, so the converter never runs)',
    (type) => expect(looksLikeHeic({ type, name: 'a.bin' })).toBe(true),
  );

  it.each([
    ['', 'IMG_1.HEIC'],
    ['', 'img.heif'],
    ['application/octet-stream', 'Photo.Heic'],
  ])('is true for blank type %j with name %s (catches the empty type Windows and Chrome give HEIC files)', (type, name) =>
    expect(looksLikeHeic({ type, name })).toBe(true),
  );

  it('does not trust a .heic name when the type says something else (catches renaming a PDF to .heic)', () => {
    expect(looksLikeHeic({ type: 'application/pdf', name: 'x.heic' })).toBe(false);
    expect(looksLikeHeic({ type: 'image/jpeg', name: 'x.heic' })).toBe(false);
  });

  it.each(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'])(
    'is true for an ftyp box with brand %s even when type and name lie (catches a renamed HEIC)',
    (brand) => expect(looksLikeHeic({ type: 'image/jpeg', name: 'holiday.jpg', head: ftyp(brand) })).toBe(true),
  );

  it.each(['avif', 'mp42', 'isom', 'qt  '])('is false for ftyp brand %s (catches treating every ISO-BMFF file as HEIC)', (brand) => {
    expect(looksLikeHeic({ type: 'image/jpeg', name: 'a.jpg', head: ftyp(brand) })).toBe(false);
  });

  it('is false for JPEG bytes, a short buffer and no bytes (catches reading past the end)', () => {
    expect(looksLikeHeic({ type: 'image/jpeg', name: 'a.jpg', head: bytes(0xff, 0xd8, 0xff, 0xe0) })).toBe(false);
    expect(looksLikeHeic({ type: '', name: 'a', head: bytes(0, 0, 0, 0x18, ...ascii('ftyp')) })).toBe(false);
    expect(looksLikeHeic({})).toBe(false);
  });

  it('needs ftyp at byte 4, not just the word somewhere (catches a substring match)', () => {
    expect(hasHeicSignature(bytes(...ascii('ftypheic'), 0, 0, 0, 0, 0, 0, 0, 0))).toBe(false);
  });
});

describe('isAcceptedPhoto', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])('accepts %s', (type) =>
    expect(isAcceptedPhoto({ type })).toBe(true),
  );
  it.each(['image/tiff', 'image/svg+xml', 'image/bmp', 'image/avif', 'application/pdf', 'video/mp4', 'text/plain'])(
    'rejects %s (catches letting any file type through to the upload)',
    (type) => expect(isAcceptedPhoto({ type, name: 'x' })).toBe(false),
  );
  it('judges a blank type by content: JPEG, PNG, GIF and WebP bytes pass, others fail (catches rejecting extensionless photos or accepting junk)', () => {
    expect(isAcceptedPhoto({ type: '', head: bytes(0xff, 0xd8, 0xff, 0xe1) })).toBe(true);
    expect(isAcceptedPhoto({ type: '', head: bytes(0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a) })).toBe(true);
    expect(isAcceptedPhoto({ type: '', head: bytes(...ascii('GIF89a')) })).toBe(true);
    expect(isAcceptedPhoto({ type: '', head: bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP')) })).toBe(true);
    expect(isAcceptedPhoto({ type: '', head: bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WAVE')) })).toBe(false);
    expect(isAcceptedPhoto({ type: '', head: bytes(...ascii('%PDF-1.7')) })).toBe(false);
    expect(isAcceptedPhoto({ type: '' })).toBe(false);
  });
  it('does not let image bytes rescue a declared non-image type (catches content sniffing overriding the type)', () => {
    expect(isAcceptedPhoto({ type: 'application/pdf', head: bytes(0xff, 0xd8, 0xff) })).toBe(false);
  });
  it('sniffPlainImage is false for no bytes', () => expect(sniffPlainImage(undefined)).toBe(false));
});

describe('factsOf', () => {
  it('reads type, name and the leading bytes of a real File (catches reading the wrong slice)', async () => {
    const f = new File([ftyp('heic'), new Uint8Array(100)], 'IMG_0001.HEIC', { type: '' });
    const facts = await factsOf(f);
    expect(facts.name).toBe('IMG_0001.HEIC');
    expect(facts.type).toBe('');
    expect(facts.head?.length).toBe(16);
    expect(hasHeicSignature(facts.head)).toBe(true);
  });
  it('works on a nameless Blob (catches a crash on canvas output blobs)', async () => {
    const facts = await factsOf(new Blob([bytes(0xff, 0xd8, 0xff)], { type: 'image/jpeg' }));
    expect(facts.name).toBeUndefined();
    expect(sniffPlainImage(facts.head)).toBe(true);
  });
});
