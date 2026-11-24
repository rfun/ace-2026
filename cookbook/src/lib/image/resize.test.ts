import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fitWithin,
  ImageTooLargeError,
  MAX_UPLOAD_BYTES,
  resizeImage,
  setImageBackend,
  SMALL_ENOUGH_BYTES,
  type ImageBackend,
} from './resize';

function blobOfSize(size: number): Blob {
  const b = new Blob(['x']);
  Object.defineProperty(b, 'size', { value: size });
  return b;
}

function fakeBackend(width: number, height: number, outSize = 10) {
  const encode = vi.fn(async () => blobOfSize(outSize));
  const close = vi.fn();
  const decode = vi.fn(async () => ({ width, height, source: {}, close }));
  const backend: ImageBackend = { decode, encode };
  return { backend, encode, decode, close };
}

afterEach(() => setImageBackend(null));

describe('fitWithin', () => {
  it('scales a landscape image by its width (catches scaling the wrong edge)', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });
  it('scales a portrait image by its height (catches scaling the wrong edge)', () => {
    expect(fitWithin(3000, 4500, 1500)).toEqual({ width: 1000, height: 1500 });
  });
  it('never scales up and leaves a fitting image alone (catches upscaling)', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });
  it('never returns a zero edge for extreme ratios (catches a 0px canvas)', () => {
    expect(fitWithin(10000, 1, 1600)).toEqual({ width: 1600, height: 1 });
  });
});

describe('resizeImage', () => {
  it('rejects input over 20 MiB before decoding (catches letting huge files through)', async () => {
    const { backend, decode } = fakeBackend(100, 100);
    setImageBackend(backend);
    await expect(resizeImage(blobOfSize(MAX_UPLOAD_BYTES + 1))).rejects.toBeInstanceOf(ImageTooLargeError);
    expect(decode).not.toHaveBeenCalled();
  });

  it('accepts exactly 20 MiB (catches an off-by-one on the limit)', async () => {
    setImageBackend(fakeBackend(100, 100).backend);
    await expect(resizeImage(blobOfSize(MAX_UPLOAD_BYTES))).resolves.toBeInstanceOf(Blob);
  });

  it('returns the original for a small, small-edged file without re-encoding (catches needless recompression)', async () => {
    const { backend, encode } = fakeBackend(800, 600);
    setImageBackend(backend);
    const file = blobOfSize(200_000);
    expect(await resizeImage(file)).toBe(file);
    expect(encode).not.toHaveBeenCalled();
  });

  it('re-encodes a large-edged photo at the fitted size and quality, and releases the bitmap (catches skipping downscale or leaking)', async () => {
    const { backend, encode, close } = fakeBackend(4000, 3000, 300_000);
    setImageBackend(backend);
    const out = await resizeImage(blobOfSize(5_000_000), { quality: 0.7 });
    expect(out.size).toBe(300_000);
    expect(encode).toHaveBeenCalledWith(expect.anything(), { width: 1600, height: 1200 }, 0.7);
    expect(close).toHaveBeenCalled();
  });

  it('honours a custom maxEdge (catches a hard-coded 1600)', async () => {
    const { backend, encode } = fakeBackend(1000, 500);
    setImageBackend(backend);
    await resizeImage(blobOfSize(100_000), { maxEdge: 500 });
    expect(encode).toHaveBeenCalledWith(expect.anything(), { width: 500, height: 250 }, 0.85);
  });

  it('re-encodes a heavy file whose edges already fit, but keeps the original if that is not smaller (catches a bigger upload)', async () => {
    const heavy = blobOfSize(SMALL_ENOUGH_BYTES + 1);
    setImageBackend(fakeBackend(1200, 900, 400_000).backend);
    expect((await resizeImage(heavy)).size).toBe(400_000);
    setImageBackend(fakeBackend(1200, 900, SMALL_ENOUGH_BYTES + 500).backend);
    expect(await resizeImage(heavy)).toBe(heavy);
  });

  it('returns the original when decoding is unsupported, as in jsdom (catches a crash on old browsers)', async () => {
    setImageBackend(null);
    const file = new Blob(['abc'], { type: 'image/png' });
    expect(await resizeImage(file)).toBe(file);
  });

  it('returns the original when encoding fails (catches losing the photo)', async () => {
    setImageBackend({ decode: async () => ({ width: 4000, height: 3000, source: {} }), encode: async () => null });
    const file = blobOfSize(3_000_000);
    expect(await resizeImage(file)).toBe(file);
  });
});
