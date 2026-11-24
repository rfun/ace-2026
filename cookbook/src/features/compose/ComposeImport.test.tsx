import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreProvider } from '../../data/StoreProvider';
import type { DataStore } from '../../data/store';
import { createMockStore } from '../../data/mock/mockStore';
import type { Me } from '../../domain/types';
import ComposeScreen from './index';

const author: Me = { id: 'u-jordan', canWrite: true, canModerate: false };
const reader: Me = { id: 'u-you', canWrite: false, canModerate: false };

const NOTES = `Besan Ladoo
Serves 4
Total time: 1 hr 15 mins

Ingredients
- 2 cups besan
- 200 g ghee

Method
1. Roast the besan.
2. Roll into balls.`;

function mount(store: DataStore, id?: string) {
  return render(
    <StoreProvider store={store}>
      <ComposeScreen id={id} />
    </StoreProvider>,
  );
}
async function ready(store: DataStore, id?: string) {
  mount(store, id);
  await screen.findByLabelText(/^Title/);
}

interface FakeSample {
  json: ReturnType<typeof vi.fn>;
  limits: ReturnType<typeof vi.fn>;
}
function fakeSample(json: (input: string, opts?: { signal?: AbortSignal }) => Promise<unknown>, images = true): FakeSample {
  return {
    json: vi.fn(json),
    limits: vi.fn(async () => ({
      maxPromptBytes: 262144,
      ...(images ? { images: { maxCount: 1, maxInputBytes: 5_000_000, mediaTypes: ['image/png', 'image/jpeg'] } } : {}),
    })),
  };
}
function installClaude(sample: FakeSample | null) {
  (globalThis as { claude?: unknown }).claude = { use: vi.fn(async (n: string) => (n === 'sample' ? sample : null)) };
}

const openPanel = () => fireEvent.click(screen.getByRole('button', { name: 'Import a recipe' }));
const paste = (t: string) => fireEvent.change(screen.getByLabelText(/^Paste the recipe/), { target: { value: t } });
const fill = () => fireEvent.click(screen.getByRole('button', { name: /^(Fill in the form|Reading)/ }));
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const png = () => new File(['x'], 'card.png', { type: 'image/png' });
const pickImage = (f: File) => fireEvent.change(document.getElementById('f-import-file')!, { target: { files: [f] } });

beforeEach(() => {
  window.location.hash = '#/compose';
  window.localStorage.clear();
  delete (globalThis as { claude?: unknown }).claude;
});
afterEach(() => {
  delete (globalThis as { claude?: unknown }).claude;
});

describe('Import a recipe: entry point', () => {
  it('shows the button on a new recipe for a writer and opens an inline panel with the textarea, photo input, Fill and Cancel', async () => {
    await ready(createMockStore({ me: author }));
    expect(screen.queryByLabelText(/^Paste the recipe/)).toBeNull();
    openPanel();
    expect(screen.getByLabelText(/^Paste the recipe/)).toBeInTheDocument();
    const file = screen.getByLabelText('Or use a photo of a recipe card') as HTMLInputElement;
    expect(file.accept).toBe('image/*');
    expect(file.getAttribute('capture')).toBe('environment');
    expect(screen.getByRole('button', { name: 'Fill in the form' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is not offered when editing an existing recipe (catches import overwriting a saved recipe)', async () => {
    await ready(createMockStore({ me: author }), 'r-besan-ladoo');
    expect(screen.queryByRole('button', { name: 'Import a recipe' })).toBeNull();
  });

  it('is not offered to a reader without write access', async () => {
    mount(createMockStore({ me: reader }));
    await screen.findByText(/adding recipes needs Contributor access/);
    expect(screen.queryByRole('button', { name: 'Import a recipe' })).toBeNull();
  });

  it('Cancel closes the panel and leaves the form alone', async () => {
    await ready(createMockStore({ me: author }));
    type(/^Title/, 'Mine');
    openPanel();
    paste(NOTES);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText(/^Paste the recipe/)).toBeNull();
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Mine');
  });
});

describe('Import a recipe: local parser (no sample)', () => {
  it('fills empty fields, labels the local reader, focuses the title, and does NOT save', async () => {
    const store = createMockStore({ me: author });
    const save = vi.spyOn(store, 'saveRecipe');
    await ready(store);
    openPanel();
    expect(screen.queryByText(/Claude reads what you paste/)).toBeNull();
    paste(NOTES);
    fill();
    await waitFor(() => expect(screen.getByLabelText(/^Title/)).toHaveValue('Besan Ladoo'));
    expect(screen.getByLabelText(/^Serves/)).toHaveValue(4);
    expect(screen.getByLabelText(/^Makes/)).toHaveValue('Serves 4');
    expect(screen.getByLabelText(/^Total time/)).toHaveValue('75');
    expect(screen.getByLabelText('Ingredient 1 Amount')).toHaveValue('2 cups');
    expect(screen.getByLabelText('Ingredient 2 Ingredient')).toHaveValue('ghee');
    expect(screen.getByLabelText('Step 2')).toHaveValue('Roll into balls.');
    expect(screen.getByText("Filled in from the text's headings — check every field")).toBeInTheDocument();
    expect(screen.getByText('Filled title, servings, makes, total time, 2 ingredients, 2 steps. Review before saving.')).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText(/^Title/));
    expect(screen.queryByLabelText(/^Paste the recipe/)).toBeNull();
    expect(save).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/compose');
  });

  it('does not overwrite a typed title or typed lists; offers to add the imported lists instead', async () => {
    await ready(createMockStore({ me: author }));
    type(/^Title/, 'My own title');
    type('Ingredient 1 Ingredient', 'my lentils');
    type('Step 1', 'My own step.');
    openPanel();
    paste(NOTES);
    fill();
    await screen.findByText(/Review before saving/);
    expect(screen.getByLabelText(/^Title/)).toHaveValue('My own title');
    expect(screen.getByLabelText('Ingredient 1 Ingredient')).toHaveValue('my lentils');
    expect(screen.queryByLabelText('Ingredient 2 Ingredient')).toBeNull();
    expect(screen.getByLabelText('Step 1')).toHaveValue('My own step.');
    expect(screen.getByLabelText(/^Makes/)).toHaveValue('Serves 4');

    fireEvent.click(screen.getByRole('button', { name: 'Add the imported ingredients too' }));
    expect(screen.getByLabelText('Ingredient 1 Ingredient')).toHaveValue('my lentils');
    expect(screen.getByLabelText('Ingredient 2 Ingredient')).toHaveValue('besan');
    expect(screen.getByLabelText('Ingredient 3 Ingredient')).toHaveValue('ghee');
    expect(screen.queryByRole('button', { name: 'Add the imported ingredients too' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add the imported steps too' }));
    expect(screen.getByLabelText('Step 1')).toHaveValue('My own step.');
    expect(screen.getByLabelText('Step 3')).toHaveValue('Roll into balls.');
  });

  it('does not overwrite a chosen course or typed minutes', async () => {
    await ready(createMockStore({ me: author }));
    type(/^Course/, 'dessert');
    type(/^Total time/, '20');
    openPanel();
    paste(NOTES);
    fill();
    await screen.findByText(/Review before saving/);
    expect(screen.getByLabelText(/^Course/)).toHaveValue('dessert');
    expect(screen.getByLabelText(/^Total time/)).toHaveValue('20');
  });

  it('does not overwrite a typed Serves (catches the import clobbering the member\'s portion count)', async () => {
    await ready(createMockStore({ me: author }));
    type(/^Serves/, '9');
    openPanel();
    paste(NOTES);
    fill();
    await screen.findByText(/Review before saving/);
    expect(screen.getByLabelText(/^Serves/)).toHaveValue(9);
  });

  it('nudges the story field without filling it when the text has no intro', async () => {
    await ready(createMockStore({ me: author }));
    expect(screen.getByLabelText(/^The story behind it/)).not.toHaveAttribute('placeholder');
    openPanel();
    paste(NOTES);
    fill();
    await screen.findByText(/Review before saving/);
    const story = screen.getByLabelText(/^The story behind it/);
    expect(story).toHaveValue('');
    expect(story).toHaveAttribute('placeholder', 'Add why this dish matters to you');
  });

  it('empty paste shows the plain sentence and nothing changes', async () => {
    await ready(createMockStore({ me: author }));
    openPanel();
    paste('   ');
    fill();
    expect(await screen.findByRole('alert')).toHaveTextContent('Paste a recipe or choose a photo first.');
    expect(screen.getByLabelText(/^Paste the recipe/)).toBeInTheDocument();
  });

  it('a photo with no sample shows the Claude-access message', async () => {
    await ready(createMockStore({ me: author }));
    openPanel();
    pickImage(png());
    fill();
    expect(await screen.findByRole('alert')).toHaveTextContent('Photo reading needs Claude access in claude.ai. Paste the text instead.');
    expect(screen.getByLabelText(/^Title/)).toHaveValue('');
  });

  it('a photo with sample === null (use("sample") resolves null) shows the same message', async () => {
    installClaude(null);
    await ready(createMockStore({ me: author }));
    openPanel();
    pickImage(png());
    fill();
    expect(await screen.findByRole('alert')).toHaveTextContent('Photo reading needs Claude access');
  });
});

describe('Import a recipe: with Claude', () => {
  it('uses Claude, shows the privacy line and the Claude label, fills the form, still does not save', async () => {
    const sample = fakeSample(async () => ({
      title: 'Claude Ladoo', course: 'sweets', dietary: ['vegetarian', 'paleo'], totalMinutes: 40,
      ingredients: [{ quantity: '2 cups', item: 'besan' }], steps: ['Roast.', 'Roll.'],
    }));
    installClaude(sample);
    const store = createMockStore({ me: author });
    const save = vi.spyOn(store, 'saveRecipe');
    await ready(store);
    openPanel();
    expect(await screen.findByText('Claude reads what you paste only to fill this form, using your Claude account.')).toBeInTheDocument();
    paste(NOTES);
    fill();
    await screen.findByText('Filled in by Claude — check every field');
    expect(sample.json).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Claude Ladoo');
    expect(screen.getByLabelText(/^Course/)).toHaveValue('sweets');
    expect(screen.getByLabelText('Vegetarian')).toBeChecked();
    expect(screen.getByLabelText(/^Total time/)).toHaveValue('40');
    expect(save).not.toHaveBeenCalled();
  });

  it('does not call Claude until the button is pressed (catches a call on load or on open)', async () => {
    const sample = fakeSample(async () => ({}));
    installClaude(sample);
    await ready(createMockStore({ me: author }));
    openPanel();
    paste(NOTES);
    await screen.findByText(/Claude reads what you paste/);
    expect(sample.json).not.toHaveBeenCalled();
  });

  it.each([['not_granted'], ['rate_limited'], ['invalid_json']])('falls back to the local reader, labelled, when Claude rejects %s', async (code) => {
    installClaude(fakeSample(async () => Promise.reject({ code, message: 'nope' })));
    await ready(createMockStore({ me: author }));
    openPanel();
    paste(NOTES);
    fill();
    await screen.findByText("Filled in from the text's headings — check every field");
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Besan Ladoo');
    expect(screen.queryByText(/not_granted|rate_limited|invalid_json/)).toBeNull();
  });

  it('while reading: the button says Reading… and is disabled; Cancel aborts the Claude call and fills nothing', async () => {
    let signal: AbortSignal | undefined;
    const sample = fakeSample(
      (_input, opts) =>
        new Promise((_, reject) => {
          signal = opts?.signal;
          signal?.addEventListener('abort', () => reject({ code: 'aborted' }));
        }),
    );
    installClaude(sample);
    await ready(createMockStore({ me: author }));
    openPanel();
    paste(NOTES);
    fill();
    const busy = await screen.findByRole('button', { name: 'Reading…' });
    expect(busy).toBeDisabled();
    await waitFor(() => expect(sample.json).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(screen.queryByLabelText(/^Paste the recipe/)).toBeNull());
    // give a wrongly-wired fallback a chance to fire
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByLabelText(/^Title/)).toHaveValue('');
    expect(screen.queryByText(/Review before saving/)).toBeNull();
  });

  it('a photo with Claude passes images: [blob] and fills from the answer', async () => {
    const sample = fakeSample(async () => ({ title: 'Card Recipe', ingredients: [{ quantity: '1', item: 'egg' }], steps: ['Boil.'] }));
    installClaude(sample);
    await ready(createMockStore({ me: author }));
    openPanel();
    pickImage(png());
    expect(screen.getByText('card.png')).toBeInTheDocument();
    fill();
    await screen.findByText('Filled in by Claude — check every field');
    const opts = sample.json.mock.calls[0][1] as { images: Blob[] };
    expect(opts.images).toHaveLength(1);
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Card Recipe');
  });

  it('a photo alone when Claude fails shows a plain sentence, never a code', async () => {
    installClaude(fakeSample(async () => Promise.reject({ code: 'rate_limited', message: 'm' })));
    await ready(createMockStore({ me: author }));
    openPanel();
    pickImage(png());
    fill();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/couldn't read that photo/i);
    expect(alert.textContent).not.toMatch(/rate_limited/);
    expect(screen.getByRole('button', { name: 'Fill in the form' })).toBeEnabled();
  });

  it('a photo when this view cannot send images says so plainly', async () => {
    installClaude(fakeSample(async () => ({}), false));
    await ready(createMockStore({ me: author }));
    openPanel();
    pickImage(png());
    fill();
    expect(await screen.findByRole('alert')).toHaveTextContent("Photo reading isn't available here. Paste the text instead.");
  });
});
