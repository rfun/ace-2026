import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreProvider } from '../../data/StoreProvider';
import type { DataStore } from '../../data/store';
import { createMockStore } from '../../data/mock/mockStore';
import { SAMPLE_RECIPES, SAMPLE_TIPS } from '../../data/mock/samples';
import type { Me } from '../../domain/types';
import RecipeScreen from './index';

const ID = 'r-besan-ladoo';
const reader: Me = { id: 'u-you', canWrite: true, canModerate: false };
const mod: Me = { id: 'u-you', canWrite: true, canModerate: true };

function mount(store: DataStore, id = ID, onAddTip?: () => void) {
  return render(
    <StoreProvider store={store}>
      <RecipeScreen id={id} onAddTip={onAddTip} />
    </StoreProvider>,
  );
}

function setup(me: Me, id = ID, onAddTip?: () => void) {
  const store = createMockStore({ me });
  mount(store, id, onAddTip);
  return store;
}

beforeEach(() => {
  window.location.hash = '#/';
});

describe('RecipePage', () => {
  it('renders the title as the single h1 (catches a missing or duplicated page heading)', async () => {
    setup(reader);
    expect(await screen.findByRole('heading', { level: 1, name: 'Besan Ladoo' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('names the contributor, lists every ingredient in a ul and the steps in order in an ol (catches dropped or reordered content)', async () => {
    setup(reader);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('From the kitchen of Jordan Example')).toBeInTheDocument();
    const ingSection = screen.getByRole('heading', { name: 'Ingredients' }).closest('section')!;
    expect(ingSection.querySelector('ul')).not.toBeNull();
    expect(within(ingSection).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '2 cupsbesan (gram flour)',
      '1/2 cupghee',
      '3/4 cuppowdered sugar',
      '1/2 tspground cardamom',
      '2 tbspchopped pistachios',
    ]);
    const stepSection = screen.getByRole('heading', { name: 'Steps' }).closest('section')!;
    expect(stepSection.querySelector('ol')).not.toBeNull();
    const steps = within(stepSection).getAllByRole('listitem');
    expect(steps).toHaveLength(5);
    expect(steps[0]).toHaveTextContent('Melt the ghee');
    expect(steps[1]).toHaveTextContent('Add the besan');
    expect(steps[4]).toHaveTextContent('Shape into walnut-sized balls');
  });

  it('prints dietary stamps as text, not colour alone (catches a symbol-only stamp)', async () => {
    setup(reader);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Vegetarian')).toBeInTheDocument();
    expect(screen.getByText('Gluten-free')).toBeInTheDocument();
  });

  it('lists tips with signed author names and no Hide for a reader (catches moderation leaking to readers)', async () => {
    setup(reader);
    const text = await screen.findByText('Roast on the lowest flame. Patience is the whole recipe.');
    const tip = text.closest('li')!;
    expect(tip).toHaveTextContent('Sam Example');
    expect(tip.closest('ul')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Hide' })).toBeNull();
  });

  it('shows the zero-tips note for a recipe with no tips (catches an empty, unexplained margin)', async () => {
    setup(reader, 'r-example-congee');
    expect(await screen.findByText('No tips yet. Be the first to write in the margin.')).toBeInTheDocument();
  });

  it('shows the not-in-the-tin card with a way back for an unknown id (catches a blank or crashing screen)', async () => {
    setup(reader, 'nope');
    expect(await screen.findByText("This card isn't in the tin.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Back to all recipes' }));
    expect(window.location.hash).toBe('#/');
  });

  it('shows a blank card, no spinner, while loading (catches a spinner or a flash of the not-found message)', async () => {
    setup(reader);
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText("This card isn't in the tin.")).toBeNull();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    await screen.findByRole('heading', { level: 1 });
  });

  it('lets a moderator hide a tip, and the control flips to Unhide (catches Hide not reaching store.setHidden)', async () => {
    const store = setup(mod);
    await screen.findByRole('heading', { level: 1 });
    const tip = screen.getByText('A pinch of salt makes the cardamom sing.').closest('li')!;
    fireEvent.click(within(tip).getByRole('button', { name: 'Hide' }));
    await waitFor(() => expect(within(tip).getByRole('button', { name: 'Unhide' })).toBeInTheDocument());
    expect((await store.listTips(ID)).find((t) => t.id === 't-ladoo-2')?.hidden).toBe(true);
  });

  it('does not render a hidden tip for a non-moderator (catches the UI re-adding hidden tips)', async () => {
    const tips = SAMPLE_TIPS.map((t) => (t.id === 't-ladoo-1' ? { ...t, hidden: true } : t));
    mount(createMockStore({ me: reader, tips }));
    await screen.findByText('A pinch of salt makes the cardamom sing.');
    expect(screen.queryByText('Roast on the lowest flame. Patience is the whole recipe.')).toBeNull();
  });

  it('treats a hidden recipe as not found for a reader (catches showing hidden recipes by direct link)', async () => {
    const recipes = SAMPLE_RECIPES.map((r) => (r.id === ID ? { ...r, hidden: true } : r));
    mount(createMockStore({ me: reader, recipes }));
    expect(await screen.findByText("This card isn't in the tin.")).toBeInTheDocument();
  });

  it('lets a moderator hide the recipe itself (catches a missing recipe-level control)', async () => {
    const store = setup(mod);
    const head = (await screen.findByRole('heading', { level: 1 })).closest('header')!;
    fireEvent.click(within(head).getByRole('button', { name: 'Hide' }));
    await waitFor(async () => expect((await store.getRecipe(ID))?.hidden).toBe(true));
  });

  it('Prop it up sets the hash to #/kitchen/<id> (catches a dead kitchen-mode button)', async () => {
    setup(reader);
    fireEvent.click(await screen.findByRole('button', { name: 'Prop it up' }));
    expect(window.location.hash).toBe(`#/kitchen/${ID}`);
  });

  it('+ Add your tip is a real button that calls onAddTip (catches a non-button or an unwired handler)', async () => {
    const onAddTip = vi.fn();
    setup(reader, ID, onAddTip);
    fireEvent.click(await screen.findByRole('button', { name: '+ Add your tip' }));
    expect(onAddTip).toHaveBeenCalledTimes(1);
  });

  it('+ Add your tip is inert without a handler (catches an unguarded onAddTip call)', async () => {
    setup(reader);
    fireEvent.click(await screen.findByRole('button', { name: '+ Add your tip' }));
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('the All recipes tab navigates to browse (catches a tab that does nothing)', async () => {
    window.location.hash = `#/recipe/${ID}`;
    setup(reader);
    fireEvent.click(await screen.findByRole('link', { name: /All recipes/ }));
    expect(window.location.hash).toBe('#/');
  });

  it('re-renders on store changes and unsubscribes on unmount (catches a stale screen or a leaked listener)', async () => {
    const store = createMockStore({ me: reader });
    const off = vi.fn();
    const orig = store.subscribe.bind(store);
    store.subscribe = (l) => {
      const un = orig(l);
      return () => {
        off();
        un();
      };
    };
    const { unmount } = mount(store);
    await screen.findByRole('heading', { level: 1 });
    await act(async () => {
      await store.addTip(ID, { text: 'Fresh tip from a test' });
    });
    expect(await screen.findByText('Fresh tip from a test')).toBeInTheDocument();
    unmount();
    expect(off).toHaveBeenCalledTimes(1);
  });
});
