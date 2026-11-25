import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoreProvider } from '../../data/StoreProvider';
import type { DataStore } from '../../data/store';
import { createMockStore } from '../../data/mock/mockStore';
import { SAMPLE_RECIPES } from '../../data/mock/samples';
import type { Me } from '../../domain/types';
import { setAuthorHandoff } from './authorHandoff';
import BrowseScreen from './index';

const writer: Me = { id: 'u-you', canWrite: true, canModerate: false };
const reader: Me = { id: 'u-you', canWrite: false, canModerate: false };

function mount(store: DataStore) {
  return render(
    <StoreProvider store={store}>
      <BrowseScreen />
    </StoreProvider>,
  );
}

beforeEach(() => {
  window.location.hash = '#/';
});

describe('BrowsePage', () => {
  it('renders every sample title, newest first (catches dropped cards or wrong order)', async () => {
    mount(createMockStore({ me: writer }));
    await screen.findByText('Besan Ladoo');
    const titles = SAMPLE_RECIPES.map((x) => x.title);
    for (const t of titles) expect(screen.getByText(t)).toBeInTheDocument();
    const shown = screen.getAllByRole('link').map((a) => a.textContent);
    // createdAt: ladoo oldest, congee next, empanadas newest
    expect(shown).toEqual(['Sample Baked Empanadas', 'Sample Ginger Congee', 'Besan Ladoo']);
  });

  it('shows author, origin, course and dietary label on a card (catches stamps without text)', async () => {
    mount(createMockStore({ me: writer }));
    const card = (await screen.findByText('Besan Ladoo')).closest<HTMLElement>('.bw-card')!;
    expect(within(card).getByText('From the kitchen of Jordan Example')).toBeInTheDocument();
    expect(card).toHaveTextContent('Punjab, India · Sweets');
    expect(card).toHaveTextContent('Gluten-free');
  });

  it('dietary filter narrows and reports pressed state (catches an inert or unlabelled chip)', async () => {
    mount(createMockStore({ me: writer }));
    await screen.findByText('Besan Ladoo');
    const vegan = screen.getByRole('button', { name: /Vegan/ });
    expect(vegan).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(vegan);
    expect(vegan).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText('Sample Ginger Congee')).toBeInTheDocument();
    // clearable individually
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter Vegan' }));
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('contributor filter shows the heading and only their recipes', async () => {
    mount(createMockStore({ me: writer }));
    await screen.findByText('Besan Ladoo');
    fireEvent.click(screen.getByRole('button', { name: 'Jordan Example' }));
    expect(screen.getByRole('heading', { name: 'Recipes from Jordan Example' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText('Besan Ladoo')).toBeInTheDocument();
  });

  it('shows the no-matches message and clear restores the grid', async () => {
    mount(createMockStore({ me: writer }));
    await screen.findByText('Besan Ladoo');
    fireEvent.change(screen.getByLabelText('Search recipes'), { target: { value: 'qqqq-nothing' } });
    expect(screen.getByText('No cards match these filters.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.queryByText('No cards match these filters.')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('empty store shows the empty-tin card, with add button only for writers', async () => {
    const { unmount } = mount(createMockStore({ me: writer, recipes: [] }));
    expect(await screen.findByText('The tin is empty. Add the first recipe.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a recipe' })).toBeInTheDocument();
    unmount();
    mount(createMockStore({ me: reader, recipes: [] }));
    expect(await screen.findByText('The tin is empty. Add the first recipe.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a recipe' })).toBeNull();
  });

  it('clicking a card sets the hash to the recipe route', async () => {
    mount(createMockStore({ me: writer }));
    fireEvent.click((await screen.findByText('Besan Ladoo')).closest('a')!);
    expect(window.location.hash).toBe('#/recipe/r-besan-ladoo');
  });

  it('add button navigates to compose and is hidden for read-only members', async () => {
    const { unmount } = mount(createMockStore({ me: writer }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add a recipe' }));
    expect(window.location.hash).toBe('#/compose');
    unmount();
    mount(createMockStore({ me: reader }));
    await screen.findByText('Besan Ladoo');
    expect(screen.queryByRole('button', { name: 'Add a recipe' })).toBeNull();
  });

  it('a load error is distinct from empty and retry recovers', async () => {
    const real = createMockStore({ me: writer });
    let fail = true;
    const store: DataStore = {
      ...real,
      listRecipes: () => (fail ? Promise.reject(new Error('boom')) : real.listRecipes()),
    };
    mount(store);
    expect(await screen.findByText("Couldn't open the tin. Try again.")).toBeInTheDocument();
    expect(screen.queryByText('The tin is empty. Add the first recipe.')).toBeNull();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Besan Ladoo')).toBeInTheDocument();
  });

  it('Filters toggle exposes aria-expanded with the active count', async () => {
    mount(createMockStore({ me: writer }));
    await screen.findByText('Besan Ladoo');
    const toggle = screen.getByRole('button', { name: 'Filters (0)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Vegan/ }));
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
  });

  it('a stale slow response never overwrites a newer one (catches missing sequencing)', async () => {
    const real = createMockStore({ me: writer });
    const all = await real.listRecipes();
    const listeners = new Set<() => void>();
    let release: () => void = () => undefined;
    let call = 0;
    const store: DataStore = {
      ...real,
      subscribe: (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      listRecipes: async () => {
        call += 1;
        if (call === 1) {
          // old request: full list, but it resolves only after the newer one
          await new Promise<void>((res) => { release = res; });
          return all;
        }
        return all.slice(0, 1);
      },
    };
    mount(store);
    await waitFor(() => expect(call).toBe(1));
    await act(async () => {
      listeners.forEach((l) => l());
    });
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(1));
    await act(async () => {
      release();
    });
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('unsubscribes on unmount (catches a leaked listener)', async () => {
    const real = createMockStore({ me: writer });
    let live = 0;
    const store: DataStore = {
      ...real,
      subscribe: (l) => {
        live += 1;
        const off = real.subscribe(l);
        return () => {
          live -= 1;
          off();
        };
      },
    };
    const { unmount } = mount(store);
    await screen.findByText('Besan Ladoo');
    expect(live).toBe(1);
    unmount();
    expect(live).toBe(0);
  });

  it('reloads when the store notifies (catches a stale grid after a save)', async () => {
    const store = createMockStore({ me: writer });
    mount(store);
    await screen.findByText('Besan Ladoo');
    await act(async () => {
      await store.saveRecipe({ ...SAMPLE_RECIPES[0], id: undefined, title: 'Freshly Added Dish' });
    });
    expect(await screen.findByText('Freshly Added Dish')).toBeInTheDocument();
  });

  // Catches: a nested link-in-link or an author control that cannot take focus on its own.
  it('card by-line is a button outside the recipe link, and the card is still one link (catches nested interactive elements)', async () => {
    mount(createMockStore({ me: writer }));
    await screen.findByText('Besan Ladoo');
    const card = screen.getByText('Besan Ladoo').closest('.bw-card') as HTMLElement;
    const by = within(card).getByRole('button', { name: 'From the kitchen of Jordan Example' });
    expect(by.closest('a')).toBeNull();
    expect(within(card).getAllByRole('link')).toHaveLength(1);
  });

  // Catches: author click not setting the filter, filter by name text, chip missing/unremovable, count not updated.
  it('clicking a card by-line filters to that person, shows a removable chip and counts as a filter', async () => {
    mount(createMockStore({ me: writer }));
    await screen.findByText('Besan Ladoo');
    fireEvent.click(screen.getByRole('button', { name: 'From the kitchen of Jordan Example' }));
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter From Jordan Example\u2019s kitchen' }));
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Filters (0)' })).toBeInTheDocument();
  });

  // Catches: author handoff ignored by browse, or left set so it re-applies on the next visit.
  it('opens already filtered to the person handed off from the recipe page, once', async () => {
    setAuthorHandoff('u-jordan');
    const first = mount(createMockStore({ me: writer }));
    await screen.findByText('Besan Ladoo');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Remove filter From Jordan Example/ })).toBeInTheDocument();
    first.unmount();
    mount(createMockStore({ me: writer }));
    await screen.findByText('Besan Ladoo');
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  // Catches: search not reaching ingredients/people through the real component, and a placeholder that hides the new scope.
  it('search box hints at the new scope and finds by ingredient and by person', async () => {
    mount(createMockStore({ me: writer }));
    await screen.findByText('Besan Ladoo');
    const box = screen.getByLabelText('Search recipes');
    expect(box).toHaveAttribute('placeholder', 'Recipes, people, ingredients\u2026');
    fireEvent.change(box, { target: { value: 'pistachios' } }); // an ingredient of Besan Ladoo only
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Besan Ladoo']);
    fireEvent.change(box, { target: { value: 'jordan' } });
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Besan Ladoo']);
  });
});
