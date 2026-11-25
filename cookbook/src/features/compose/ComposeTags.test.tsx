import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StoreProvider } from '../../data/StoreProvider';
import type { DataStore } from '../../data/store';
import { createMockStore } from '../../data/mock/mockStore';
import type { Me } from '../../domain/types';
import { installSmallImageBackend, resetImageBackend } from '../../lib/image/testing';
import ComposeScreen from './index';
import { TAG_HINT, TAG_TOO_LONG, TAG_TOO_MANY } from './tagInput';

const ID = 'r-besan-ladoo'; // authored by u-jordan, has tags
const author: Me = { id: 'u-jordan', canWrite: true, canModerate: false };

async function ready(store: DataStore, id?: string) {
  render(
    <StoreProvider store={store}>
      <ComposeScreen id={id} />
    </StoreProvider>,
  );
  await screen.findByLabelText(/^Title/);
}

const box = () => screen.getByLabelText('Keywords') as HTMLInputElement;
const typeText = (v: string) => fireEvent.change(box(), { target: { value: v } });
const press = (key: string) => fireEvent.keyDown(box(), { key });
const chips = () => screen.queryAllByRole('button', { name: /^Remove keyword / }).map((b) => b.getAttribute('aria-label')!.replace('Remove keyword ', ''));
const paste = (text: string) => fireEvent.paste(box(), { clipboardData: { getData: () => text } });

beforeEach(() => {
  installSmallImageBackend();
  window.location.hash = '#/compose';
  window.localStorage.clear();
});
afterEach(() => resetImageBackend());

describe('Compose keywords', () => {
  // Catches: the field missing, or its hint wording drifting from the spec.
  it('shows an optional Keywords field with the specified hint', async () => {
    await ready(createMockStore({ me: author }));
    expect(box()).not.toBeRequired();
    expect(screen.getByText(TAG_HINT)).toBeInTheDocument();
    expect(TAG_HINT).toBe('Words people might search for, like noodles or soup');
    expect(box()).toHaveAccessibleDescription(TAG_HINT);
  });

  // Catches: Enter not adding a chip, or Enter submitting the recipe form instead.
  it('Enter adds a chip and clears the box', async () => {
    await ready(createMockStore({ me: author }));
    typeText('Noodles');
    press('Enter');
    expect(chips()).toEqual(['noodles']);
    expect(box().value).toBe('');
    expect(screen.queryByText(/things need fixing|One thing needs fixing/)).toBeNull();
  });

  // Catches: Enter or comma keydown not being default-prevented (a real browser would then submit the form / type the comma).
  it('prevents the default action of Enter and comma (fireEvent returns false)', async () => {
    await ready(createMockStore({ me: author }));
    typeText('soup');
    expect(fireEvent.keyDown(box(), { key: 'Enter' })).toBe(false);
    typeText('rice');
    expect(fireEvent.keyDown(box(), { key: ',' })).toBe(false);
    expect(chips()).toEqual(['soup', 'rice']);
    // other keys keep their default
    expect(fireEvent.keyDown(box(), { key: 'a' })).toBe(true);
  });

  // Catches: comma key not adding (keydown path).
  it('the comma key adds a chip', async () => {
    await ready(createMockStore({ me: author }));
    typeText('soup');
    press(',');
    expect(chips()).toEqual(['soup']);
  });

  // Catches: a comma typed through onChange (phone keyboards) leaving a literal comma in the box.
  it('a comma arriving as text adds the word before it', async () => {
    await ready(createMockStore({ me: author }));
    typeText('soup,');
    expect(chips()).toEqual(['soup']);
    expect(box().value).toBe('');
  });

  // Catches: Backspace on a non-empty box deleting a chip, or on an empty box doing nothing.
  it('Backspace on an empty box removes the last chip; with text it leaves chips alone', async () => {
    await ready(createMockStore({ me: author }));
    typeText('a,');
    typeText('b,');
    typeText('x');
    press('Backspace');
    expect(chips()).toEqual(['a', 'b']);
    typeText('');
    press('Backspace');
    expect(chips()).toEqual(['a']);
  });

  // Catches: paste adding one merged chip or only the first word.
  it('pasting "noodles, soup" adds both', async () => {
    await ready(createMockStore({ me: author }));
    paste('noodles, soup');
    expect(chips()).toEqual(['noodles', 'soup']);
    expect(box().value).toBe('');
  });

  // Catches: the remove button missing or removing the wrong chip.
  it('the x button removes that chip only', async () => {
    await ready(createMockStore({ me: author }));
    paste('a, b, c');
    fireEvent.click(screen.getByRole('button', { name: 'Remove keyword b' }));
    expect(chips()).toEqual(['a', 'c']);
  });

  // Catches: limits enforced silently (no text message) or the rejected word being lost.
  it('shows a text message for a 25-character word and keeps it in the box', async () => {
    await ready(createMockStore({ me: author }));
    typeText('z'.repeat(25));
    press('Enter');
    expect(screen.getByRole('alert')).toHaveTextContent(TAG_TOO_LONG);
    expect(chips()).toEqual([]);
    expect(box().value).toBe('z'.repeat(25));
  });

  it('shows a text message for an 11th keyword', async () => {
    await ready(createMockStore({ me: author }));
    paste(Array.from({ length: 10 }, (_, i) => `w${i}`).join(','));
    expect(chips()).toHaveLength(10);
    typeText('eleventh');
    press('Enter');
    expect(chips()).toHaveLength(10);
    expect(screen.getByRole('alert')).toHaveTextContent(TAG_TOO_MANY);
  });

  // Catches: a word typed but not confirmed being lost when the member moves on to Save.
  it('adds what is still typed when the box loses focus', async () => {
    await ready(createMockStore({ me: author }));
    typeText('dumplings');
    fireEvent.blur(box());
    expect(chips()).toEqual(['dumplings']);
  });

  // Catches: edit opening without the saved keywords.
  it('edit pre-fills the saved keywords', async () => {
    await ready(createMockStore({ me: author }), ID);
    expect(chips()).toEqual(['sweet', 'gram flour', 'festival']);
  });

  // Catches: chips not reaching the store, or being saved un-normalised, and removal not persisting on edit.
  it('saves added chips normalised, and a removed chip is gone from the stored recipe', async () => {
    const store = createMockStore({ me: author });
    await ready(store, ID);
    typeText('Rice  Noodles');
    press('Enter');
    fireEvent.click(screen.getByRole('button', { name: 'Remove keyword sweet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
    await waitFor(() => expect(window.location.hash).toBe(`#/recipe/${ID}`));
    expect((await store.getRecipe(ID))!.tags).toEqual(['gram flour', 'festival', 'rice noodles']);
  });
});
