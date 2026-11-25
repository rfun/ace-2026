import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreProvider } from '../../data/StoreProvider';
import type { DataStore } from '../../data/store';
import { createMockStore } from '../../data/mock/mockStore';
import { SAMPLE_MADE } from '../../data/mock/samples';
import type { Me } from '../../domain/types';
import { resetImageBackend } from '../../lib/image/testing';
import { installSmallImageBackend } from '../../lib/image/testing';
import RecipeScreen from '../recipe';
import { MADE_EMPTY } from './MadeSection';
import { requestMadeComposer } from './handoff';

// Sample data, worked out by hand from src/data/mock/samples.ts:
//  r-besan-ladoo: one made note (u-jordan), u-sam has it on Made it, u-you has it on neither -> "Made by 2".
//  r-example-congee: u-you and u-lee want it, nobody made it, no notes -> "2 want to make".
const LADOO = 'r-besan-ladoo';
const CONGEE = 'r-example-congee';
const writer: Me = { id: 'u-you', canWrite: true, canModerate: false };
const readOnly: Me = { id: 'u-you', canWrite: false, canModerate: false };
const mod: Me = { id: 'u-you', canWrite: true, canModerate: true };

function mount(store: DataStore, id: string) {
  return render(
    <StoreProvider store={store}>
      <RecipeScreen id={id} />
    </StoreProvider>,
  );
}
const want = () => screen.getByRole('button', { name: 'Want to make' });
const made = () => screen.getByRole('button', { name: 'Made it' });
const shelfBox = () => document.querySelector('.mk-shelf') as HTMLElement;
const area = async () => (await screen.findByLabelText('How did it go?')) as HTMLTextAreaElement;

beforeEach(() => {
  window.location.hash = '#/';
});
afterEach(() => vi.restoreAllMocks());

describe('shelf buttons', () => {
  it('start on the stored state and show a plain count line (catches ignoring the stored shelf, or a missing count)', async () => {
    mount(createMockStore({ me: writer }), CONGEE);
    await screen.findByRole('heading', { level: 1 });
    expect(want()).toHaveAttribute('aria-pressed', 'true');
    expect(made()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('2 want to make')).toBeInTheDocument();
  });

  it('pressing the other button moves the mark and the counts, one at a time (catches both buttons pressed)', async () => {
    mount(createMockStore({ me: writer }), CONGEE);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(made());
    expect(made()).toHaveAttribute('aria-pressed', 'true');
    expect(want()).toHaveAttribute('aria-pressed', 'false');
    // 2 want -> I moved to made: 1 still want, 1 made.
    expect(screen.getByText('Made by 1 · 1 want to make')).toBeInTheDocument();
  });

  it('pressing the pressed button clears it to none, and the store agrees (catches a toggle that cannot be undone)', async () => {
    const store = createMockStore({ me: writer });
    const spy = vi.spyOn(store, 'setShelf');
    mount(store, CONGEE);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(want());
    expect(want()).toHaveAttribute('aria-pressed', 'false');
    expect(made()).toHaveAttribute('aria-pressed', 'false');
    expect(spy).toHaveBeenCalledWith(CONGEE, 'none');
    await waitFor(async () => expect((await store.myShelf()).want).not.toContain(CONGEE));
    expect(screen.getByText('1 want to make')).toBeInTheDocument();
  });

  it('shows the new state at once, then goes back with a message when the save fails (catches a lying button)', async () => {
    const store = createMockStore({ me: writer });
    let fail: (e: Error) => void = () => undefined;
    vi.spyOn(store, 'setShelf').mockImplementation(() => new Promise((_, reject) => { fail = reject; }));
    mount(store, CONGEE);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(made());
    expect(made()).toHaveAttribute('aria-pressed', 'true'); // before the store answers
    fail(new Error('too-large'));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save that. Try again.");
    expect(made()).toHaveAttribute('aria-pressed', 'false');
    expect(want()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('2 want to make')).toBeInTheDocument(); // count reverted too
  });

  it('ignores a second press while a save is in flight (catches racing writes)', async () => {
    const store = createMockStore({ me: writer });
    const spy = vi.spyOn(store, 'setShelf').mockImplementation(() => new Promise(() => undefined));
    mount(store, CONGEE);
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(made());
    fireEvent.click(want());
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('are hidden, not disabled, for read-only members, who still see the count (catches write UI for viewers)', async () => {
    mount(createMockStore({ me: readOnly }), CONGEE);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Want to make' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Made it' })).toBeNull();
    expect(screen.queryByLabelText('How did it go?')).toBeNull();
    expect(screen.getByText('2 want to make')).toBeInTheDocument();
  });

  it('count line is plain text with only numbers, never names, and not a live region (catches leaking the private shelf)', async () => {
    mount(createMockStore({ me: writer }), LADOO);
    await screen.findByRole('heading', { level: 1 });
    expect(within(shelfBox()).getByText('Made by 2')).toBeInTheDocument();
    expect(shelfBox().querySelector('[aria-live]')).toBeNull();
    expect(shelfBox().textContent).not.toMatch(/Sam|Lee/);
  });

  it('shows no count line when nobody has acted (catches an empty "Made by 0" line)', async () => {
    mount(createMockStore({ me: writer, made: [], shelves: {} }), LADOO);
    await screen.findByRole('heading', { level: 1 });
    expect(shelfBox().querySelector('.mk-count')).toBeNull();
  });
});

describe('I made this section', () => {
  it('lists notes with author and date, before the tips section (catches a missing note, or wrong order)', async () => {
    mount(createMockStore({ me: writer }), LADOO);
    const heading = await screen.findByRole('heading', { name: 'I made this' });
    expect(screen.getByText(SAMPLE_MADE[0].text)).toBeInTheDocument();
    const section = heading.closest('section')!;
    expect(within(section).getByText('Jordan Example')).toBeInTheDocument();
    expect(section.querySelector('time')).toHaveAttribute('datetime', new Date(SAMPLE_MADE[0].createdAt).toISOString());
    const tips = screen.getByRole('heading', { name: 'Tips from the tin' });
    expect(heading.compareDocumentPosition(tips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the empty state when nobody has posted (catches a blank section)', async () => {
    mount(createMockStore({ me: writer }), CONGEE);
    expect(await screen.findByText(MADE_EMPTY)).toBeInTheDocument();
    expect(MADE_EMPTY).toBe('Nobody has posted yet. Made it? Tell us how it went.');
  });

  it('posting adds the note, flips the shelf to Made it and bumps the count (catches a post that leaves the buttons stale)', async () => {
    const store = createMockStore({ me: writer });
    mount(store, LADOO);
    fireEvent.change(await area(), { target: { value: 'Added extra cardamom.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post it' }));
    expect(await screen.findByText('Added extra cardamom.')).toBeInTheDocument();
    expect(made()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Made by 3')).toBeInTheDocument(); // jordan + sam + me
    expect((await store.myShelf()).made).toContain(LADOO);
    expect((await area()).value).toBe(''); // composer cleared
  });

  it('uses the "I made this" placeholder (catches the wrong prompt)', async () => {
    mount(createMockStore({ me: writer }), CONGEE);
    expect(await area()).toHaveAttribute('placeholder', 'I made this — here’s what I found…');
  });

  it('rejects empty text without calling the store (catches blank posts)', async () => {
    const store = createMockStore({ me: writer });
    const spy = vi.spyOn(store, 'addMade');
    mount(store, CONGEE);
    await area();
    fireEvent.click(screen.getByRole('button', { name: 'Post it' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Write something first.');
    expect(spy).not.toHaveBeenCalled();
  });

  it('keeps the text and says so when posting fails (catches a lost note)', async () => {
    const store = createMockStore({ me: writer });
    vi.spyOn(store, 'addMade').mockRejectedValue(new Error('too-large'));
    mount(store, CONGEE);
    fireEvent.change(await area(), { target: { value: 'still here' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post it' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't post that. It's still here.");
    expect((await area()).value).toBe('still here');
    expect(made()).toHaveAttribute('aria-pressed', 'false'); // a failed post does not claim "made"
  });

  it('a photo needs a description before posting, like tips (catches photos without alt text)', async () => {
    installSmallImageBackend();
    URL.createObjectURL = () => 'blob:fake';
    const store = createMockStore({ me: writer });
    const spy = vi.spyOn(store, 'addMade');
    mount(store, CONGEE);
    fireEvent.change(await area(), { target: { value: 'with photo' } });
    fireEvent.change(screen.getByLabelText('Photo (optional)'), { target: { files: [new File(['img'], 'a.jpg', { type: 'image/jpeg' })] } });
    await screen.findByLabelText('Describe the photo');
    fireEvent.click(screen.getByRole('button', { name: 'Post it' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Describe the photo for people who cannot see it.');
    expect(spy).not.toHaveBeenCalled();
    resetImageBackend();
  });

  it('moderators can hide and unhide a note; members never see Hide (catches missing or leaked moderation)', async () => {
    const store = createMockStore({ me: mod });
    mount(store, LADOO);
    await screen.findByText(SAMPLE_MADE[0].text);
    const note = screen.getByText(SAMPLE_MADE[0].text).closest('li')!;
    fireEvent.click(within(note).getByRole('button', { name: 'Hide' }));
    expect(await within(note).findByRole('button', { name: 'Unhide' })).toBeInTheDocument();
    expect(within(note).getByText('Hidden from others')).toBeInTheDocument();
    expect((await store.listMade(LADOO))[0].hidden).toBe(true);
    fireEvent.click(within(note).getByRole('button', { name: 'Unhide' }));
    expect(await within(note).findByRole('button', { name: 'Hide' })).toBeInTheDocument();
  });

  it('a hidden note is gone for members and they get no Hide button (catches showing moderated notes)', async () => {
    const hidden = [{ ...SAMPLE_MADE[0], hidden: true }];
    mount(createMockStore({ me: writer, made: hidden }), LADOO);
    await screen.findByRole('heading', { name: 'I made this' });
    expect(screen.queryByText(SAMPLE_MADE[0].text)).toBeNull();
    expect(screen.getByText(MADE_EMPTY)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hide' })).toBeNull();
  });

  it('the kitchen handoff scrolls to and focuses the composer (catches a dead "Tell us how it went" link)', async () => {
    requestMadeComposer();
    mount(createMockStore({ me: writer }), CONGEE);
    await waitFor(async () => expect(await area()).toHaveFocus());
  });

  it('without a handoff the composer is not focused (catches stealing focus on every visit)', async () => {
    mount(createMockStore({ me: writer }), CONGEE);
    expect(await area()).not.toHaveFocus();
  });
});
