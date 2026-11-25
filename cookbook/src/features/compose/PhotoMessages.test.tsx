import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreProvider } from '../../data/StoreProvider';
import { createMockStore } from '../../data/mock/mockStore';
import type { DataStore } from '../../data/store';
import type { Me } from '../../domain/types';
import { HeicConversionError, PhotoPermissionError, PhotoUploadError } from '../../lib/image/errors';
import { setHeicConverterLoader } from '../../lib/image/heic';
import { setImageBackend, type ImageBackend } from '../../lib/image/resize';
import { installSmallImageBackend, resetImageBackend } from '../../lib/image/testing';
import ComposeScreen from './index';

const author: Me = { id: 'u-jordan', canWrite: true, canModerate: false };

const HINT = 'JPG, PNG, WebP or HEIC · up to 20 MB';
const TOO_LARGE = 'That photo is over 20 MB. Choose a smaller one.';
const UNSUPPORTED = "That file type isn't supported. Use a JPG, PNG, WebP or HEIC photo.";
const HEIC_FAILED =
  "We couldn't convert that iPhone photo. Share it as a JPG (or set iPhone Camera > Formats > Most Compatible) and try again.";
const NO_PERMISSION = "You don't have permission to add photos here. Ask an organiser for access.";
const UPLOAD_FAILED = "The photo didn't upload. Check your connection and try again.";

const file = (name: string, type: string, size?: number) => {
  const f = new File(['img'], name, { type });
  if (size !== undefined) Object.defineProperty(f, 'size', { value: size });
  return f;
};
const pick = (inputId: string, f: File) => fireEvent.change(document.getElementById(inputId)!, { target: { files: [f] } });

async function ready(store: DataStore) {
  render(
    <StoreProvider store={store}>
      <ComposeScreen />
    </StoreProvider>,
  );
  await screen.findByLabelText(/^Title/);
}

beforeEach(() => {
  installSmallImageBackend();
  window.location.hash = '#/compose';
  window.localStorage.clear();
  URL.createObjectURL = () => 'blob:test-photo';
});
afterEach(() => {
  resetImageBackend();
  setHeicConverterLoader(null);
  vi.restoreAllMocks();
});

const SURFACES = [
  ['recipe photo', 'f-file-main'],
  ['step photo', 'f-file-s-0'],
] as const;

describe.each(SURFACES)('compose %s', (_name, inputId) => {
  it('shows the limits hint before anything is picked and links it to the input (catches limits only appearing after a failure)', async () => {
    await ready(createMockStore({ me: author }));
    const input = document.getElementById(inputId)!;
    const hint = document.getElementById(`${inputId}-hint`)!;
    expect(hint).toHaveTextContent(HINT);
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
  });

  it('too large: the specific sentence, role=alert, input marked invalid, nothing uploaded (catches the generic failure for oversize)', async () => {
    const store = createMockStore({ me: author });
    const up = vi.spyOn(store, 'uploadPhoto');
    await ready(store);
    pick(inputId, file('big.jpg', 'image/jpeg', 21 * 1024 * 1024));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(TOO_LARGE);
    const input = document.getElementById(inputId)!;
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(alert.id);
    expect(up).not.toHaveBeenCalled();
  });

  it('unsupported type: the unsupported sentence and nothing uploaded (catches a PDF being sent to the store)', async () => {
    const store = createMockStore({ me: author });
    const up = vi.spyOn(store, 'uploadPhoto');
    await ready(store);
    pick(inputId, file('menu.pdf', 'application/pdf'));
    expect(await screen.findByText(UNSUPPORTED)).toBeInTheDocument();
    expect(up).not.toHaveBeenCalled();
  });

  it('no permission: the ask-an-organiser sentence, not the retry one (catches telling a viewer to check their connection)', async () => {
    const store = createMockStore({ me: author });
    vi.spyOn(store, 'uploadPhoto').mockRejectedValue(new PhotoPermissionError());
    await ready(store);
    pick(inputId, file('a.jpg', 'image/jpeg'));
    expect(await screen.findByText(NO_PERMISSION)).toBeInTheDocument();
    expect(screen.queryByText(UPLOAD_FAILED)).toBeNull();
  });

  it('upload failure: the connection sentence, and choosing again works (catches a dead retry path)', async () => {
    const store = createMockStore({ me: author });
    vi.spyOn(store, 'uploadPhoto').mockRejectedValueOnce(new PhotoUploadError());
    await ready(store);
    pick(inputId, file('a.jpg', 'image/jpeg'));
    expect(await screen.findByText(UPLOAD_FAILED)).toBeInTheDocument();
    pick(inputId, file('a.jpg', 'image/jpeg'));
    expect(await screen.findByRole('button', { name: 'Remove photo' })).toBeInTheDocument();
    expect(screen.queryByText(UPLOAD_FAILED)).toBeNull();
  });

  it('HEIC that cannot be converted: the iPhone sentence (catches the generic upload message for a conversion failure)', async () => {
    const store = createMockStore({ me: author });
    const up = vi.spyOn(store, 'uploadPhoto');
    const noHeic: ImageBackend = { decode: async () => null, encode: async () => null };
    setImageBackend(noHeic);
    setHeicConverterLoader(async () => {
      throw new HeicConversionError();
    });
    await ready(store);
    pick(inputId, file('IMG_1.HEIC', 'image/heic'));
    expect(await screen.findByText(HEIC_FAILED)).toBeInTheDocument();
    expect(up).not.toHaveBeenCalled();
  });

  it('shows "Preparing photo…" while converting, then uploads the converted JPEG, not the HEIC (catches silent waiting and a raw HEIC upload)', async () => {
    const store = createMockStore({ me: author });
    const up = vi.spyOn(store, 'uploadPhoto');
    const jpeg = new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' });
    let finish: () => void = () => {};
    // Native decode fails for the HEIC and works for the converted JPEG.
    setImageBackend({
      decode: async (b) => (b === jpeg ? { width: 800, height: 600, source: {} } : null),
      encode: async () => jpeg,
    });
    setHeicConverterLoader(async () => ({
      convert: () => new Promise<Blob>((res) => { finish = () => res(jpeg); }),
    }));
    await ready(store);
    pick(inputId, file('IMG_2.HEIC', 'image/heic'));
    expect(await screen.findByText('Preparing photo…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save recipe' })).toBeDisabled();
    finish();
    await screen.findByRole('button', { name: 'Remove photo' });
    expect(up).toHaveBeenCalledTimes(1);
    expect(up.mock.calls[0][0]).toBe(jpeg);
  });
});

describe('compose import photo', () => {
  const openPanel = async () => {
    await ready(createMockStore({ me: author }));
    fireEvent.click(screen.getByRole('button', { name: /Import/ }));
  };

  it('shows the limits hint (catches the import picker lacking limits)', async () => {
    await openPanel();
    const hint = document.getElementById('f-import-photo-hint')!;
    expect(hint).toHaveTextContent(HINT);
    expect(document.getElementById('f-import-file')!.getAttribute('aria-describedby')).toContain(hint.id);
  });

  it.each([
    ['too large', file('big.jpg', 'image/jpeg', 21 * 1024 * 1024), TOO_LARGE],
    ['unsupported', file('menu.pdf', 'application/pdf'), UNSUPPORTED],
  ])('%s: the specific sentence at pick time, input invalid (catches a generic import failure)', async (_n, f, text) => {
    await openPanel();
    pick('f-import-file', f);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(text);
    expect(document.getElementById('f-import-file')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull();
  });

  it('HEIC conversion failure shows the iPhone sentence (catches the generic import failure)', async () => {
    await openPanel();
    setImageBackend({ decode: async () => null, encode: async () => null });
    setHeicConverterLoader(async () => {
      throw new Error('offline');
    });
    pick('f-import-file', file('IMG_3.HEIC', 'image/heic'));
    expect(await screen.findByRole('alert')).toHaveTextContent(HEIC_FAILED);
  });

  it('shows "Preparing photo…" and keeps the Fill button off until the photo is ready (catches importing before conversion finishes)', async () => {
    await openPanel();
    const jpeg = new Blob(['j'], { type: 'image/jpeg' });
    let finish: () => void = () => {};
    setImageBackend({
      decode: async (b) => (b === jpeg ? { width: 10, height: 10, source: {} } : null),
      encode: async () => jpeg,
    });
    setHeicConverterLoader(async () => ({ convert: () => new Promise<Blob>((res) => { finish = () => res(jpeg); }) }));
    pick('f-import-file', file('IMG_4.HEIC', 'image/heic'));
    expect(await screen.findByText('Preparing photo…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fill in the form' })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove photo' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Fill in the form' })).toBeEnabled();
  });
});
