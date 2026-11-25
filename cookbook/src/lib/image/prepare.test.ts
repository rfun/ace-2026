import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeicConversionError, UnreadableImageError, UnsupportedImageError } from './errors';
import { setHeicConverterLoader, type HeicConverter } from './heic';
import { preparePhoto } from './prepare';
import { ImageTooLargeError, MAX_UPLOAD_BYTES, setImageBackend, type ImageBackend } from './resize';

const heicBytes = (): Uint8Array<ArrayBuffer> => {
  const b = new Uint8Array(32);
  b.set([0, 0, 0, 0x18], 0);
  b.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
  b.set([0x68, 0x65, 0x69, 0x63], 8); // heic
  return b;
};
const heicFile = (name = 'IMG_1.HEIC', type = 'image/heic') => new File([heicBytes()], name, { type });
const jpegBytes = (): Uint8Array<ArrayBuffer> => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const jpegFile = (name = 'a.jpg') => new File([jpegBytes()], name, { type: 'image/jpeg' });
const withSize = <T extends Blob>(b: T, size: number): T => {
  Object.defineProperty(b, 'size', { value: size });
  return b;
};

/** Fake browser: HEIC bytes are undecodable unless `nativeHeic`; everything else decodes at width x height. */
function fakeBackend(opts: { width?: number; height?: number; nativeHeic?: boolean; encodeNull?: boolean; decodeAll?: boolean } = {}) {
  const { width = 800, height = 600 } = opts;
  const encoded = new Blob(['encoded-jpeg'], { type: 'image/jpeg' });
  const sizes: Array<{ width: number; height: number }> = [];
  const decode = vi.fn(async (blob: Blob) => {
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const isHeic = head[4] === 0x66 && head[8] === 0x68;
    if (isHeic && !opts.nativeHeic) return null;
    if (opts.decodeAll === false) return null;
    return { width, height, source: {} };
  });
  const encode = vi.fn(async (_img: unknown, size: { width: number; height: number }) => {
    sizes.push(size);
    return opts.encodeNull ? null : encoded;
  });
  const backend: ImageBackend = { decode, encode };
  return { backend, decode, encode, encoded, sizes };
}

function fakeConverter(out: Blob | Error) {
  const convert = vi.fn(async () => {
    if (out instanceof Error) throw out;
    return out;
  });
  const load = vi.fn(async (): Promise<HeicConverter> => ({ convert }));
  return { convert, load };
}

const convertedJpeg = () => new Blob([jpegBytes()], { type: 'image/jpeg' });

beforeEach(() => setHeicConverterLoader(null));
afterEach(() => {
  setImageBackend(null);
  setHeicConverterLoader(null);
});

describe('preparePhoto: validation', () => {
  it('rejects a file over 20 MiB before reading or decoding it (catches huge files reaching the decoder)', async () => {
    const f = fakeBackend();
    setImageBackend(f.backend);
    await expect(preparePhoto(withSize(jpegFile(), MAX_UPLOAD_BYTES + 1))).rejects.toBeInstanceOf(ImageTooLargeError);
    expect(f.decode).not.toHaveBeenCalled();
  });

  it('accepts exactly 20 MiB (catches an off-by-one on the limit)', async () => {
    setImageBackend(fakeBackend().backend);
    await expect(preparePhoto(withSize(jpegFile(), MAX_UPLOAD_BYTES))).resolves.toBeInstanceOf(Blob);
  });

  it.each([
    ['application/pdf', 'menu.pdf'],
    ['image/tiff', 'scan.tif'],
    ['image/svg+xml', 'logo.svg'],
    ['text/plain', 'notes.txt'],
    ['', 'mystery'],
  ])('rejects type %j (%s) as unsupported without decoding it (catches an unsupported file being uploaded)', async (type, name) => {
    const f = fakeBackend();
    setImageBackend(f.backend);
    await expect(preparePhoto(new File(['not an image'], name, { type }))).rejects.toBeInstanceOf(UnsupportedImageError);
    expect(f.decode).not.toHaveBeenCalled();
  });
});

describe('preparePhoto: ordinary photos', () => {
  it('a JPEG the browser can read passes through untouched and never loads the converter (catches downloading the 3 MB converter for every photo)', async () => {
    const f = fakeBackend({ width: 800, height: 600 });
    setImageBackend(f.backend);
    const conv = fakeConverter(convertedJpeg());
    setHeicConverterLoader(conv.load);
    const file = jpegFile();
    expect(await preparePhoto(file)).toBe(file);
    expect(conv.load).not.toHaveBeenCalled();
  });

  it('shrinks a big photo to the 1600 edge (catches the resize step being skipped)', async () => {
    const f = fakeBackend({ width: 4000, height: 3000 });
    setImageBackend(f.backend);
    expect(await preparePhoto(jpegFile())).toBe(f.encoded);
    expect(f.sizes).toEqual([{ width: 1600, height: 1200 }]);
  });

  it('a non-HEIC file the browser cannot decode is UnreadableImageError, not converted and not passed through (catches uploading undecodable bytes)', async () => {
    const f = fakeBackend({ decodeAll: false });
    setImageBackend(f.backend);
    const conv = fakeConverter(convertedJpeg());
    setHeicConverterLoader(conv.load);
    await expect(preparePhoto(jpegFile())).rejects.toBeInstanceOf(UnreadableImageError);
    expect(conv.load).not.toHaveBeenCalled();
  });
});

describe('preparePhoto: HEIC', () => {
  it('native decode fails, so it converts then resizes: the result is the encoded JPEG, never the HEIC (catches a raw HEIC reaching upload)', async () => {
    const f = fakeBackend({ width: 4000, height: 3000 });
    setImageBackend(f.backend);
    const jpeg = convertedJpeg();
    const conv = fakeConverter(jpeg);
    setHeicConverterLoader(conv.load);
    const file = heicFile();
    const out = await preparePhoto(file);
    expect(conv.convert).toHaveBeenCalledWith(file);
    expect(out).toBe(f.encoded);
    expect(out).not.toBe(file);
    expect(f.sizes).toEqual([{ width: 1600, height: 1200 }]);
  });

  it('a small converted JPEG is kept as the JPEG (catches double re-encoding losing quality), and still is not the HEIC', async () => {
    const f = fakeBackend({ width: 800, height: 600 });
    setImageBackend(f.backend);
    const jpeg = convertedJpeg();
    setHeicConverterLoader(fakeConverter(jpeg).load);
    const file = heicFile();
    const out = await preparePhoto(file);
    expect(out).toBe(jpeg);
    expect(out).not.toBe(file);
  });

  it('finds a HEIC with an empty type by its .heic name (catches the converter being skipped for Chrome/Edge on Windows)', async () => {
    const f = fakeBackend();
    setImageBackend(f.backend);
    const conv = fakeConverter(convertedJpeg());
    setHeicConverterLoader(conv.load);
    await preparePhoto(new File([heicBytes()], 'IMG_2.heic', { type: '' }));
    expect(conv.convert).toHaveBeenCalledTimes(1);
  });

  it('a browser that CAN decode HEIC (Safari) still re-encodes it to JPEG, even when small (catches the passthrough rule uploading the raw HEIC)', async () => {
    const f = fakeBackend({ width: 800, height: 600, nativeHeic: true });
    setImageBackend(f.backend);
    const conv = fakeConverter(convertedJpeg());
    setHeicConverterLoader(conv.load);
    const file = heicFile();
    const out = await preparePhoto(file);
    expect(out).toBe(f.encoded);
    expect(out).not.toBe(file);
    expect(conv.load).not.toHaveBeenCalled();
  });

  it('native decode ok but the encoder gives nothing: HeicConversionError, never the raw HEIC (catches a silent fallback to the original)', async () => {
    setImageBackend(fakeBackend({ nativeHeic: true, encodeNull: true }).backend);
    await expect(preparePhoto(heicFile())).rejects.toBeInstanceOf(HeicConversionError);
  });

  it('converter fails to load: HeicConversionError (catches an offline or blocked converter file uploading the raw HEIC)', async () => {
    setImageBackend(fakeBackend().backend);
    setHeicConverterLoader(async () => {
      throw new Error('404 heic-to.js');
    });
    await expect(preparePhoto(heicFile())).rejects.toBeInstanceOf(HeicConversionError);
  });

  it('converter throws during conversion: HeicConversionError (catches the raw error leaking to the person)', async () => {
    setImageBackend(fakeBackend().backend);
    setHeicConverterLoader(fakeConverter(new Error('ERR_LIBHEIF format not supported')).load);
    await expect(preparePhoto(heicFile())).rejects.toBeInstanceOf(HeicConversionError);
  });

  it('converter returns something that is still HEIC: HeicConversionError (catches trusting the converter blindly)', async () => {
    setImageBackend(fakeBackend().backend);
    setHeicConverterLoader(fakeConverter(new Blob([heicBytes()], { type: 'image/jpeg' })).load);
    await expect(preparePhoto(heicFile())).rejects.toBeInstanceOf(HeicConversionError);
  });

  it('converted output the browser cannot decode: HeicConversionError (catches uploading an unreadable result)', async () => {
    const f = fakeBackend({ decodeAll: false });
    setImageBackend(f.backend);
    setHeicConverterLoader(fakeConverter(convertedJpeg()).load);
    await expect(preparePhoto(heicFile())).rejects.toBeInstanceOf(HeicConversionError);
  });

  it('two HEIC photos in a row load the converter once (catches a fetch per photo)', async () => {
    setImageBackend(fakeBackend().backend);
    const conv = fakeConverter(convertedJpeg());
    setHeicConverterLoader(conv.load);
    await preparePhoto(heicFile());
    await preparePhoto(heicFile('IMG_2.HEIC'));
    expect(conv.load).toHaveBeenCalledTimes(1);
    expect(conv.convert).toHaveBeenCalledTimes(2);
  });
});
