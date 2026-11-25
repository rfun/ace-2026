import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadHeicConverter, setHeicConverterLoader, type HeicConverter } from './heic';

const converter: HeicConverter = { convert: async (b) => b };

afterEach(() => setHeicConverterLoader(null));

describe('loadHeicConverter', () => {
  it('loads once for concurrent and later callers (catches one 3 MB fetch per photo)', async () => {
    const load = vi.fn(async () => converter);
    setHeicConverterLoader(load);
    const [a, b] = await Promise.all([loadHeicConverter(), loadHeicConverter()]);
    const c = await loadHeicConverter();
    expect(load).toHaveBeenCalledTimes(1);
    expect(a).toBe(converter);
    expect(b).toBe(converter);
    expect(c).toBe(converter);
  });

  it('does not load at all until asked (catches an eager download for people who never pick a HEIC)', () => {
    const load = vi.fn(async () => converter);
    setHeicConverterLoader(load);
    expect(load).not.toHaveBeenCalled();
  });

  it('a failed load is not cached, so a retry after reconnecting can work (catches a permanently broken converter after one network blip)', async () => {
    const load = vi.fn<() => Promise<HeicConverter>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(converter);
    setHeicConverterLoader(load);
    await expect(loadHeicConverter()).rejects.toThrow('offline');
    await expect(loadHeicConverter()).resolves.toBe(converter);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
