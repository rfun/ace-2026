import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StoreProvider } from '../../data/StoreProvider';
import type { DataStore } from '../../data/store';
import { createMockStore } from '../../data/mock/mockStore';
import type { Me } from '../../domain/types';
import { TipComposer } from './TipComposer';

const writer: Me = { id: 'u-you', canWrite: true, canModerate: false };
const viewer: Me = { id: 'u-you', canWrite: false, canModerate: false };

function mount(store: DataStore) {
  const onDone = vi.fn();
  const onCancel = vi.fn();
  render(
    <StoreProvider store={store}>
      <TipComposer recipeId="r1" onDone={onDone} onCancel={onCancel} />
    </StoreProvider>,
  );
  return { onDone, onCancel };
}
const area = async () => (await screen.findByLabelText('Your tip')) as HTMLTextAreaElement;
const type = async (v: string) => fireEvent.change(await area(), { target: { value: v } });
const submitBtn = () => screen.getByRole('button', { name: 'Pin it to the card' });
const png = (name = 'a.png') => new File(['a'], name, { type: 'image/png' });

describe('TipComposer', () => {
  it('submit stores the trimmed tip and calls onDone (catches tip not saved / untrimmed / callback skipped)', async () => {
    const store = createMockStore({ me: writer, recipes: [], tips: [] });
    const { onDone } = mount(store);
    await type('  more cardamom  ');
    fireEvent.click(submitBtn());
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    const tips = await store.listTips('r1');
    expect(tips.map((t) => t.text)).toEqual(['more cardamom']);
    expect(onDone.mock.calls[0][0].id).toBe(tips[0].id);
  });

  it('blocks whitespace-only text with a message and no store call (catches empty tips)', async () => {
    const store = createMockStore({ me: writer, recipes: [], tips: [] });
    const spy = vi.spyOn(store, 'addTip');
    const { onDone } = mount(store);
    await type('   \n ');
    fireEvent.click(submitBtn());
    expect(await screen.findByText('Write something first.')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('enforces the 600 character limit (catches an unbounded textarea)', async () => {
    mount(createMockStore({ me: writer, recipes: [], tips: [] }));
    await type('x'.repeat(700));
    expect((await area()).value).toHaveLength(600);
    expect(screen.getByText('600 / 600')).toBeInTheDocument();
  });

  it('read-only members see only the access message and a working close (catches write UI for non-writers)', async () => {
    const { onCancel } = mount(createMockStore({ me: viewer, recipes: [], tips: [] }));
    expect(await screen.findByText('Adding tips needs Contributor access.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Your tip')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('autofocuses the textarea (catches missing keyboard entry point)', async () => {
    mount(createMockStore({ me: writer, recipes: [], tips: [] }));
    const a = await area();
    await waitFor(() => expect(a).toHaveFocus());
  });

  it('Escape with empty text cancels immediately (catches a pointless confirm)', async () => {
    const { onCancel } = mount(createMockStore({ me: writer, recipes: [], tips: [] }));
    fireEvent.keyDown(await area(), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape with text asks inline before discarding, without window.confirm (catches lost drafts)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { onCancel } = mount(createMockStore({ me: writer, recipes: [], tips: [] }));
    await type('draft');
    fireEvent.keyDown(await area(), { key: 'Escape' });
    expect(screen.getByRole('group', { name: 'Discard this tip?' })).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep writing' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect((await area()).value).toBe('draft');
    fireEvent.keyDown(await area(), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Enter submits (catches missing keyboard submit)', async () => {
    const store = createMockStore({ me: writer, recipes: [], tips: [] });
    const { onDone } = mount(store);
    await type('quick');
    fireEvent.keyDown(await area(), { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it('a chosen photo without alt text blocks submit (catches inaccessible photos)', async () => {
    const store = createMockStore({ me: writer, recipes: [], tips: [] });
    const addSpy = vi.spyOn(store, 'addTip');
    const upSpy = vi.spyOn(store, 'uploadPhoto');
    // jsdom has no real blob URLs; the mock store's uploadPhoto needs one
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    mount(store);
    await type('with photo');
    fireEvent.change(await screen.findByLabelText('Photo (optional)'), { target: { files: [png()] } });
    fireEvent.click(submitBtn());
    expect(await screen.findByText(/Describe the photo for people/)).toBeInTheDocument();
    expect(addSpy).not.toHaveBeenCalled();
    expect(upSpy).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Describe the photo'), { target: { value: 'A tin of ladoo' } });
    fireEvent.click(submitBtn());
    await waitFor(() => expect(addSpy).toHaveBeenCalled());
    expect(addSpy.mock.calls[0][1].photo?.alt).toBe('A tin of ladoo');
  });

  it('rejects photos over 20 MiB and removing a photo clears it (catches oversize upload / stuck attachment)', async () => {
    const store = createMockStore({ me: writer, recipes: [], tips: [] });
    mount(store);
    const big = png('big.png');
    Object.defineProperty(big, 'size', { value: 20 * 1024 * 1024 + 1 });
    const input = await screen.findByLabelText('Photo (optional)');
    fireEvent.change(input, { target: { files: [big] } });
    expect(screen.getByText(/over 20 MB/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Describe the photo')).toBeNull();
    fireEvent.change(input, { target: { files: [png('ok.png')] } });
    expect(screen.getByLabelText('Describe the photo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(screen.queryByLabelText('Describe the photo')).toBeNull();
  });

  it('a save failure keeps the text and shows the error linked to the textarea (catches lost text / silent failure)', async () => {
    const store = createMockStore({ me: writer, recipes: [], tips: [] });
    vi.spyOn(store, 'addTip').mockRejectedValue(new Error('boom'));
    const { onDone } = mount(store);
    await type('keep me');
    fireEvent.click(submitBtn());
    const err = await screen.findByText("Couldn't pin your tip. It's still here.");
    expect(onDone).not.toHaveBeenCalled();
    expect((await area()).value).toBe('keep me');
    expect((await area()).getAttribute('aria-describedby')).toContain(err.id);
    expect(submitBtn()).not.toBeDisabled();
  });

  it('disables submit while saving (catches double-submit)', async () => {
    const store = createMockStore({ me: writer, recipes: [], tips: [] });
    let release: () => void = () => {};
    const real = store.addTip.bind(store);
    const addSpy = vi.spyOn(store, 'addTip').mockImplementation(async (r, t) => {
      await new Promise<void>((res) => { release = res; });
      return real(r, t);
    });
    mount(store);
    await type('slow');
    fireEvent.click(submitBtn());
    const btn = await screen.findByRole('button', { name: 'Pinning…' });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    release();
    await waitFor(() => expect(addSpy).toHaveBeenCalledTimes(1));
  });
});
