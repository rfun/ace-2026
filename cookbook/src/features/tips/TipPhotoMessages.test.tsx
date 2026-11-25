import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreProvider } from '../../data/StoreProvider';
import { createMockStore } from '../../data/mock/mockStore';
import type { DataStore } from '../../data/store';
import type { Me } from '../../domain/types';
import { PhotoPermissionError, PhotoUploadError } from '../../lib/image/errors';
import { setHeicConverterLoader } from '../../lib/image/heic';
import { setImageBackend } from '../../lib/image/resize';
import { installSmallImageBackend, resetImageBackend } from '../../lib/image/testing';
import { TipComposer } from './TipComposer';

const writer: Me = { id: 'u-you', canWrite: true, canModerate: false };

const HINT = 'JPG, PNG, WebP or HEIC · up to 20 MB';
const TOO_LARGE = 'That photo is over 20 MB. Choose a smaller one.';
const UNSUPPORTED = "That file type isn't supported. Use a JPG, PNG, WebP or HEIC photo.";
const NO_PERMISSION = "You don't have permission to add photos here. Ask an organiser for access.";
const UPLOAD_FAILED = "The photo didn't upload. Check your connection and try again.";
const HEIC_FAILED =
  "We couldn't convert that iPhone photo. Share it as a JPG (or set iPhone Camera > Formats > Most Compatible) and try again.";

const file = (name: string, type: string, size?: number) => {
  const f = new File(['img'], name, { type });
  if (size !== undefined) Object.defineProperty(f, 'size', { value: size });
  return f;
};

function mount(store: DataStore) {
  render(
    <StoreProvider store={store}>
      <TipComposer recipeId="r1" onDone={vi.fn()} onCancel={vi.fn()} />
    </StoreProvider>,
  );
}
const input = async () => (await screen.findByLabelText('Photo (optional)')) as HTMLInputElement;
const pick = async (f: File) => fireEvent.change(await input(), { target: { files: [f] } });
const writeTip = async () => fireEvent.change(await screen.findByLabelText('Your tip'), { target: { value: 'a tip' } });

beforeEach(() => {
  installSmallImageBackend();
  URL.createObjectURL = () => 'blob:fake';
});
afterEach(() => {
  resetImageBackend();
  setHeicConverterLoader(null);
  vi.restoreAllMocks();
});

describe('tip composer photo', () => {
  it('shows the limits hint up front and links it to the input (catches limits only appearing after a failure)', async () => {
    mount(createMockStore({ me: writer, recipes: [], tips: [] }));
    const el = await input();
    const hint = screen.getByText(HINT);
    expect(el.getAttribute('aria-describedby')).toContain(hint.id);
  });

  it('too large: the specific sentence, alert role, input invalid (catches the generic message)', async () => {
    mount(createMockStore({ me: writer, recipes: [], tips: [] }));
    await pick(file('big.jpg', 'image/jpeg', 21 * 1024 * 1024));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(TOO_LARGE);
    const el = await input();
    expect(el).toHaveAttribute('aria-invalid', 'true');
    expect(el.getAttribute('aria-describedby')).toContain(alert.id);
  });

  it('unsupported type: the unsupported sentence and no description field (catches attaching a PDF)', async () => {
    mount(createMockStore({ me: writer, recipes: [], tips: [] }));
    await pick(file('menu.pdf', 'application/pdf'));
    expect(await screen.findByText(UNSUPPORTED)).toBeInTheDocument();
    expect(screen.queryByLabelText('Describe the photo')).toBeNull();
  });

  it('HEIC conversion failure: the iPhone sentence (catches the generic message)', async () => {
    mount(createMockStore({ me: writer, recipes: [], tips: [] }));
    setImageBackend({ decode: async () => null, encode: async () => null });
    setHeicConverterLoader(async () => {
      throw new Error('404');
    });
    await pick(file('IMG_1.HEIC', 'image/heic'));
    expect(await screen.findByText(HEIC_FAILED)).toBeInTheDocument();
  });

  it('no permission on upload: the ask-an-organiser sentence and the tip is not pinned (catches a retry hint for a permission problem)', async () => {
    const store = createMockStore({ me: writer, recipes: [], tips: [] });
    vi.spyOn(store, 'uploadPhoto').mockRejectedValue(new PhotoPermissionError());
    const add = vi.spyOn(store, 'addTip');
    mount(store);
    await writeTip();
    await pick(file('a.jpg', 'image/jpeg'));
    fireEvent.change(await screen.findByLabelText('Describe the photo'), { target: { value: 'A tin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pin it to the card' }));
    expect(await screen.findByText(NO_PERMISSION)).toBeInTheDocument();
    expect(add).not.toHaveBeenCalled();
  });

  it('upload failure keeps the tip, shows the connection sentence, and a second try succeeds (catches a dead retry path)', async () => {
    const store = createMockStore({ me: writer, recipes: [], tips: [] });
    vi.spyOn(store, 'uploadPhoto').mockRejectedValueOnce(new PhotoUploadError());
    const add = vi.spyOn(store, 'addTip');
    mount(store);
    await writeTip();
    await pick(file('a.jpg', 'image/jpeg'));
    fireEvent.change(await screen.findByLabelText('Describe the photo'), { target: { value: 'A tin' } });
    const pin = () => fireEvent.click(screen.getByRole('button', { name: 'Pin it to the card' }));
    pin();
    expect(await screen.findByText(UPLOAD_FAILED)).toBeInTheDocument();
    expect(((await screen.findByLabelText('Your tip')) as HTMLTextAreaElement).value).toBe('a tip');
    pin();
    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
  });

  it('shows "Preparing photo…" and holds the pin button until converted (catches pinning a tip without its photo)', async () => {
    mount(createMockStore({ me: writer, recipes: [], tips: [] }));
    const jpeg = new Blob(['j'], { type: 'image/jpeg' });
    let finish: () => void = () => {};
    setImageBackend({ decode: async (b) => (b === jpeg ? { width: 10, height: 10, source: {} } : null), encode: async () => jpeg });
    setHeicConverterLoader(async () => ({ convert: () => new Promise<Blob>((res) => { finish = () => res(jpeg); }) }));
    await pick(file('IMG_2.HEIC', 'image/heic'));
    expect(await screen.findByText('Preparing photo…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pin it to the card' })).toBeDisabled();
    finish();
    expect(await screen.findByLabelText('Describe the photo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pin it to the card' })).toBeEnabled();
  });
});
