import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreProvider } from '../../data/StoreProvider';
import type { DataStore } from '../../data/store';
import { createMockStore } from '../../data/mock/mockStore';
import type { Me } from '../../domain/types';
import ComposeScreen from './index';
import { DRAFT_KEY } from './form';

const ID = 'r-besan-ladoo'; // authored by u-jordan
const author: Me = { id: 'u-jordan', canWrite: true, canModerate: false };
const stranger: Me = { id: 'u-you', canWrite: true, canModerate: false };
const mod: Me = { id: 'u-you', canWrite: true, canModerate: true };
const authorMod: Me = { id: 'u-jordan', canWrite: true, canModerate: true };
const reader: Me = { id: 'u-you', canWrite: false, canModerate: false };

function mount(store: DataStore, id?: string) {
  return render(
    <StoreProvider store={store}>
      <ComposeScreen id={id} />
    </StoreProvider>,
  );
}

async function ready(store: DataStore, id?: string) {
  mount(store, id);
  await screen.findByRole('heading', { level: 1 });
  await screen.findByLabelText(/^Title/);
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

function fillRequired() {
  type(/^Title/, 'Test Dal');
  type(/^The story behind it/, 'A fake story for a fake dal.');
  type(/^Culture or region/, 'Testland');
  type(/^Course/, 'main');
  type('Ingredient 1 Ingredient', 'lentils');
  type('Step 1', 'Simmer the lentils.');
}

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
const imageFile = (name = 'p.png', size?: number) => {
  const f = new File(['img'], name, { type: 'image/png' });
  if (size !== undefined) Object.defineProperty(f, 'size', { value: size });
  return f;
};
const pickPhoto = (inputId: string, file: File) =>
  fireEvent.change(document.getElementById(inputId)!, { target: { files: [file] } });

beforeEach(() => {
  window.location.hash = '#/compose';
  window.localStorage.clear();
  // vitest's jsdom createObjectURL rejects jsdom Files; the page only needs a url string.
  URL.createObjectURL = () => 'blob:test-photo';
});

describe('ComposePage access', () => {
  it('shows the read-only message and no form when canWrite is false (catches readers seeing a form)', async () => {
    mount(createMockStore({ me: reader }));
    expect(await screen.findByText('You can read the cookbook, but adding recipes needs Contributor access.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Title/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save recipe' })).toBeNull();
  });

  it('blocks a non-author from editing (catches missing ownership check)', async () => {
    mount(createMockStore({ me: stranger }), ID);
    expect(await screen.findByText('Only the person who added this recipe can edit it.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Title/)).toBeNull();
  });

  it('blocks a moderator who is not the author from editing (catches the moderator override coming back)', async () => {
    mount(createMockStore({ me: mod }), ID);
    expect(await screen.findByText('Only the person who added this recipe can edit it.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Title/)).toBeNull();
  });

  it('lets an author who is also a moderator edit their own recipe', async () => {
    await ready(createMockStore({ me: authorMod }), ID);
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Besan Ladoo');
  });

  it('says the card is not in the tin for an unknown id, with a way back (catches a blank screen)', async () => {
    mount(createMockStore({ me: author }), 'r-nope');
    expect(await screen.findByText("This card isn't in the tin.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to all recipes/ })).toBeInTheDocument();
  });

  it('reports a load failure as such, not as a missing card (catches a fetch error hidden as "not in the tin")', async () => {
    const store = createMockStore({ me: author });
    vi.spyOn(store, 'getRecipe').mockRejectedValue(new Error('net'));
    mount(store, ID);
    expect(await screen.findByText(/Couldn't load this card/)).toBeInTheDocument();
    expect(screen.queryByText("This card isn't in the tin.")).toBeNull();
  });

  it('falls back to the id in the route when no prop is passed, as App renders it (catches edit mode never loading)', async () => {
    window.location.hash = `#/compose/${ID}`;
    const store = createMockStore({ me: author });
    render(
      <StoreProvider store={store}>
        <ComposeScreen />
      </StoreProvider>,
    );
    await waitFor(() => expect(screen.getByLabelText(/^Title/)).toHaveValue('Besan Ladoo'));
  });
});

describe('ComposePage validation', () => {
  it('shows inline errors, a focused summary with links, and makes no store call when invalid (catches saving bad data)', async () => {
    const store = createMockStore({ me: author });
    const spy = vi.spyOn(store, 'saveRecipe');
    await ready(store);
    save();
    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('things need fixing');
    await waitFor(() => expect(summary).toHaveFocus());
    expect(screen.getByLabelText(/^Title/)).toHaveAttribute('aria-invalid', 'true');
    expect(within(summary).getByRole('link', { name: 'Give the recipe a title.' })).toBeInTheDocument();
    expect(within(summary).getByRole('link', { name: 'Choose a course.' })).toBeInTheDocument();
    expect(within(summary).getByRole('link', { name: 'Add at least one ingredient.' })).toBeInTheDocument();
    expect(within(summary).getByRole('link', { name: 'Add at least one step.' })).toBeInTheDocument();
    expect(screen.getAllByText('Give the recipe a title.').length).toBe(2); // inline + summary
    expect(spy).not.toHaveBeenCalled();
    fireEvent.click(within(summary).getByRole('link', { name: 'Give the recipe a title.' }));
    expect(screen.getByLabelText(/^Title/)).toHaveFocus();
  });

  it('rejects a non-integer or zero total time (catches NaN or 0 minutes being saved)', async () => {
    const store = createMockStore({ me: author });
    await ready(store);
    fillRequired();
    type(/^Total time/, '1.5');
    save();
    expect((await screen.findAllByText(/whole number of minutes/)).length).toBeGreaterThan(0);
    type(/^Total time/, '0');
    save();
    expect((await screen.findAllByText(/whole number of minutes/)).length).toBeGreaterThan(0);
  });
});

describe('ComposePage saving', () => {
  it('saves a new recipe, drops empty rows, navigates to it and stores it (catches a lost save or kept blank rows)', async () => {
    const store = createMockStore({ me: author });
    await ready(store);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Add an ingredient' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a step' }));
    type('Ingredient 1 Amount', '1 cup');
    type(/^Occasions/, 'Diwali,  weddings ,');
    type(/^Total time/, '45');
    fireEvent.click(screen.getByLabelText(/Vegan/));
    type(/^Culture or region/, 'Ōaxaca — 東京');
    save();
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/recipe\/r-/));
    const id = decodeURIComponent(window.location.hash.replace('#/recipe/', ''));
    const saved = await store.getRecipe(id);
    expect(saved).toMatchObject({
      title: 'Test Dal',
      origin: 'Ōaxaca — 東京',
      course: 'main',
      occasions: ['Diwali', 'weddings'],
      dietary: ['vegan'],
      totalMinutes: 45,
      authorId: 'u-jordan',
    });
    expect(saved!.ingredients).toEqual([{ quantity: '1 cup', item: 'lentils' }]);
    expect(saved!.steps).toHaveLength(1);
    expect(saved!.steps[0].text).toBe('Simmer the lentils.');
  });

  it('edit mode loads existing values and saves changes while keeping hidden and sample (catches losing flags or the id)', async () => {
    const store = createMockStore({ me: authorMod });
    await store.setHidden('recipe', ID, true);
    await ready(store, ID);
    expect(screen.getByLabelText(/^Culture or region/)).not.toHaveValue('');
    expect((screen.getByLabelText('Step 2') as HTMLTextAreaElement).value).toContain('Add the besan');
    type(/^Title/, 'Besan Ladoo (edited)');
    save();
    await waitFor(() => expect(window.location.hash).toBe(`#/recipe/${ID}`));
    const after = (await store.getRecipe(ID))!;
    expect(after.title).toBe('Besan Ladoo (edited)');
    expect(after.id).toBe(ID);
    expect(after.authorId).toBe('u-jordan');
    expect(after.hidden).toBe(true);
    expect(after.sample).toBe(true);
    expect(after.steps).toHaveLength(5);
  });

  it('shows the save-failed message and keeps the form text when the store throws (catches wiping the form on error)', async () => {
    const store = createMockStore({ me: author });
    vi.spyOn(store, 'saveRecipe').mockRejectedValue(new Error('boom'));
    await ready(store);
    fillRequired();
    save();
    expect(await screen.findByText("Couldn't save. Your text is still here.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Test Dal');
    expect(window.location.hash).toBe('#/compose');
    expect(screen.getByRole('button', { name: 'Save recipe' })).toBeEnabled();
  });

  it('cancel goes back to the recipe when editing and to browse when new (catches wrong cancel target)', async () => {
    const store = createMockStore({ me: author });
    const first = render(<StoreProvider store={store}><ComposeScreen id={ID} /></StoreProvider>);
    await screen.findByLabelText(/^Title/);
    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(window.location.hash).toBe(`#/recipe/${ID}`);
    first.unmount();
    await ready(store);
    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(window.location.hash).toBe('#/');
  });
});

describe('ComposePage rows', () => {
  it('adds, removes and reorders steps (catches broken ordering or removing the wrong row)', async () => {
    await ready(createMockStore({ me: author }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a step' }));
    type('Step 1', 'first');
    type('Step 2', 'second');
    type('Step 3', 'third');
    fireEvent.click(screen.getByRole('button', { name: 'Move step 3 up' }));
    expect([1, 2, 3].map((n) => (screen.getByLabelText(`Step ${n}`) as HTMLTextAreaElement).value)).toEqual(['first', 'third', 'second']);
    fireEvent.click(screen.getByRole('button', { name: 'Move step 1 down' }));
    expect([1, 2, 3].map((n) => (screen.getByLabelText(`Step ${n}`) as HTMLTextAreaElement).value)).toEqual(['third', 'first', 'second']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove step 2' }));
    expect([1, 2].map((n) => (screen.getByLabelText(`Step ${n}`) as HTMLTextAreaElement).value)).toEqual(['third', 'second']);
    expect(screen.queryByLabelText('Step 3')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move step 1 up' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move step 2 down' })).toBeNull();
  });

  it('keeps ingredient order when saved after a reorder (catches reorder not reaching the saved draft)', async () => {
    const store = createMockStore({ me: author });
    await ready(store);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Add an ingredient' }));
    type('Ingredient 2 Ingredient', 'salt');
    fireEvent.click(screen.getByRole('button', { name: 'Move ingredient 2 up' }));
    save();
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/recipe\/r-/));
    const saved = (await store.getRecipe(decodeURIComponent(window.location.hash.replace('#/recipe/', ''))))!;
    expect(saved.ingredients.map((i) => i.item)).toEqual(['salt', 'lentils']);
  });
});

describe('ComposePage photos', () => {
  it('uses image/* with capture on step photo inputs (catches a desktop-only picker on phones)', async () => {
    await ready(createMockStore({ me: author }));
    const input = document.getElementById('f-file-s-0')!;
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input).toHaveAttribute('capture', 'environment');
  });

  it('blocks save when a photo has no alt text, then saves with it (catches inaccessible photos)', async () => {
    const store = createMockStore({ me: author });
    const spy = vi.spyOn(store, 'saveRecipe');
    await ready(store);
    fillRequired();
    type(/^Title/, ' '); // so the prefill has nothing to use; refilled below
    type('Step 1', '');
    pickPhoto('f-file-s-0', imageFile());
    await screen.findByRole('button', { name: 'Remove photo' });
    type('Step 1', 'Stir well.');
    type(/^Title/, 'Test Dal');
    expect(screen.getByLabelText(/^Photo description/)).toHaveValue('');
    save();
    expect((await screen.findAllByText('Describe this photo for people who cannot see it.')).length).toBeGreaterThan(0);
    expect(spy).not.toHaveBeenCalled();
    type(/^Photo description/, 'A pot of dal on the stove');
    save();
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    const arg = spy.mock.calls[0][0];
    expect(arg.steps[0].photo?.alt).toBe('A pot of dal on the stove');
  });

  it('prefills alt text from the step text (catches the prompt being empty)', async () => {
    await ready(createMockStore({ me: author }));
    type('Step 1', 'Fold in the nuts');
    pickPhoto('f-file-s-0', imageFile());
    await screen.findByRole('button', { name: 'Remove photo' });
    expect(screen.getByLabelText(/^Photo description/)).toHaveValue('Fold in the nuts');
  });

  it('shows an error and no thumbnail for a file over 20 MiB, and never uploads it (catches oversize uploads)', async () => {
    const store = createMockStore({ me: author });
    const up = vi.spyOn(store, 'uploadPhoto');
    await ready(store);
    pickPhoto('f-file-main', imageFile('big.png', 21 * 1024 * 1024));
    expect(await screen.findByText('That photo is larger than 20 MB. Choose a smaller one.')).toBeInTheDocument();
    expect(up).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull();
  });

  it('disables Save while an upload is in flight and re-enables after (catches saving mid-upload)', async () => {
    const store = createMockStore({ me: author });
    let release: (v: { assetId: string; url: string; alt: string }) => void = () => {};
    vi.spyOn(store, 'uploadPhoto').mockImplementation(() => new Promise((res) => { release = res; }));
    await ready(store);
    pickPhoto('f-file-main', imageFile());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save recipe' })).toBeDisabled());
    expect(screen.getByText('Uploading photo…')).toBeInTheDocument();
    release({ assetId: 'a1', url: 'blob:x', alt: '' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save recipe' })).toBeEnabled());
  });

  it('shows an upload error and lets the user remove a finished photo (catches a stuck state)', async () => {
    const store = createMockStore({ me: author });
    vi.spyOn(store, 'uploadPhoto').mockRejectedValueOnce(new Error('net'));
    await ready(store);
    pickPhoto('f-file-main', imageFile());
    expect(await screen.findByText('The photo did not upload. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save recipe' })).toBeEnabled();
    pickPhoto('f-file-main', imageFile());
    fireEvent.click(await screen.findByRole('button', { name: 'Remove photo' }));
    expect(screen.queryByLabelText(/^Photo description/)).toBeNull();
  });
});

describe('ComposePage draft safety', () => {
  it('keeps typed text in localStorage and restores it on return (catches losing work on navigation)', async () => {
    const first = render(<StoreProvider store={createMockStore({ me: author })}><ComposeScreen /></StoreProvider>);
    await screen.findByLabelText(/^Title/);
    type(/^Title/, 'Half-written Soup');
    type('Step 1', 'Chop things');
    expect(window.localStorage.getItem(DRAFT_KEY)).toContain('Half-written Soup');
    first.unmount();
    await ready(createMockStore({ me: author }));
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Half-written Soup');
    expect(screen.getByLabelText('Step 1')).toHaveValue('Chop things');
    expect(screen.getByText(/kept your unsaved draft/)).toBeInTheDocument();
  });

  it('clears the draft on save (catches a stale draft reappearing after saving)', async () => {
    await ready(createMockStore({ me: author }));
    fillRequired();
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    save();
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/recipe\/r-/));
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('Discard draft empties the form and the stored draft (catches a discard that leaves text behind)', async () => {
    await ready(createMockStore({ me: author }));
    type(/^Title/, 'Throwaway');
    fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
    expect(screen.getByLabelText(/^Title/)).toHaveValue('');
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('never stores a draft while editing an existing recipe (catches edits overwriting the new-recipe draft)', async () => {
    window.localStorage.setItem(DRAFT_KEY, '{"keep":"me"}');
    await ready(createMockStore({ me: author }), ID);
    type(/^Title/, 'Changed');
    expect(window.localStorage.getItem(DRAFT_KEY)).toBe('{"keep":"me"}');
  });
});
