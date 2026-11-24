import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoreProvider } from '../../data/StoreProvider';
import { createMockStore } from '../../data/mock/mockStore';
import { SAMPLE_RECIPES } from '../../data/mock/samples';
import RecipeScreen from '../recipe';
import KitchenScreen from './index';

const ID = 'r-besan-ladoo'; // serves 8: 2 cups, 1/2 cup, 3/4 cup, 1/2 tsp, 2 tbsp
const KEY = `cookbook.servings.${ID}`;

const qtys = () => Array.from(document.querySelectorAll('.kt-qty')).map((e) => e.textContent);

async function openKitchen(id = ID) {
  render(
    <StoreProvider store={createMockStore()}>
      <KitchenScreen id={id} />
    </StoreProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.location.hash = `#/kitchen/${ID}`;
});

describe('kitchen servings', () => {
  it('shows the original amounts and "Serves 8" when nothing was adjusted (catches scaling by default)', async () => {
    await openKitchen();
    expect(screen.getByRole('group', { name: 'Servings' })).toHaveTextContent('Serves 8');
    expect(qtys()).toEqual(['2 cups', '1/2 cup', '3/4 cup', '1/2 tsp', '2 tbsp']);
  });

  it('opens with the servings the recipe card chose, scaled the same way (catches kitchen ignoring the handoff)', async () => {
    window.sessionStorage.setItem(KEY, '12');
    await openKitchen();
    expect(screen.getByRole('group', { name: 'Servings' })).toHaveTextContent('Serves 12');
    expect(qtys()).toEqual(['3 cups', '¾ cup', '1⅛ cup', '¾ tsp', '3 tbsp']);
  });

  it('has its own fewer / more buttons and Reset that agree with the card (catches a read-only or divergent control)', async () => {
    await openKitchen();
    fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
    fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
    expect(screen.getByRole('group', { name: 'Servings' })).toHaveTextContent('Serves 10');
    // 2 x 10/8 = 2.5; 1/2 x 1.25 = 0.625 -> 2/3; 3/4 x 1.25 = 0.9375 -> 1; 2 x 1.25 = 2.5
    expect(qtys()).toEqual(['2½ cups', '⅔ cup', '1 cup', '⅔ tsp', '2½ tbsp']);
    expect(window.sessionStorage.getItem(KEY)).toBe('10');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(qtys()[0]).toBe('2 cups');
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('keeps a ticked ingredient ticked while servings change', async () => {
    await openKitchen();
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
    expect((screen.getAllByRole('checkbox')[1] as HTMLInputElement).checked).toBe(true);
  });

  it('shows no servings control for a recipe without serves', async () => {
    await openKitchen('r-example-empanadas');
    expect(screen.queryByRole('group', { name: 'Servings' })).toBeNull();
  });

  it('shows the card\'s note for amounts with no number, only once servings differ', async () => {
    const recipe = { ...SAMPLE_RECIPES[0], ingredients: [{ quantity: '2 cups', item: 'flour' }, { quantity: 'a pinch', item: 'salt' }] };
    render(
      <StoreProvider store={createMockStore({ recipes: [recipe] })}>
        <KitchenScreen id={ID} />
      </StoreProvider>,
    );
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(/aren.t scaled/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
    expect(screen.getAllByText("Amounts without a number aren't scaled")).toHaveLength(1);
    expect(qtys()).toEqual(['2\u00BC cups', 'a pinch']);
  });

  it('round-trips: card choice -> kitchen -> back on the card shows the same number', async () => {
    window.location.hash = `#/recipe/${ID}`;
    const store = createMockStore();
    const first = render(
      <StoreProvider store={store}>
        <RecipeScreen id={ID} />
      </StoreProvider>,
    );
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
    first.unmount();
    await openKitchen();
    expect(screen.getByRole('group', { name: 'Servings' })).toHaveTextContent('Serves 9');
    // Opening the card again reads the same stored number.
    cleanup();
    window.location.hash = `#/recipe/${ID}`;
    render(
      <StoreProvider store={store}>
        <RecipeScreen id={ID} />
      </StoreProvider>,
    );
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('group', { name: 'Servings' })).toHaveTextContent('Serves 9');
  });
});
