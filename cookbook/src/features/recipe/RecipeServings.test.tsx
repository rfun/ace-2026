import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// The test runner blanks CSS imports, so read the stylesheet text from disk (tests run from cookbook/).
// @ts-ignore node types are not installed for the browser build; this runs under vitest only.
import { readFileSync } from 'node:fs';
import { StoreProvider } from '../../data/StoreProvider';
import { createMockStore } from '../../data/mock/mockStore';
import { SAMPLE_RECIPES } from '../../data/mock/samples';
import type { Recipe } from '../../domain/types';
import RecipeScreen from './index';

const css: string = readFileSync('src/features/recipe/recipe.css', 'utf8');
const ID = 'r-besan-ladoo'; // serves 8: 2 cups, 1/2 cup, 3/4 cup, 1/2 tsp, 2 tbsp
const NO_SERVES = 'r-example-empanadas';

function mount(id = ID, recipes?: Recipe[]) {
  const store = createMockStore({ me: { id: 'u-you', canWrite: true, canModerate: false }, recipes });
  render(
    <StoreProvider store={store}>
      <RecipeScreen id={id} />
    </StoreProvider>,
  );
  return store;
}

const quantities = () =>
  within(screen.getByRole('heading', { name: 'Ingredients' }).closest('section')!)
    .getAllByRole('listitem')
    .map((li) => li.querySelector('.rc-qty')!.textContent);
const more = () => fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
const fewer = () => fireEvent.click(screen.getByRole('button', { name: 'Fewer servings' }));

beforeEach(() => {
  window.sessionStorage.clear();
  window.location.hash = `#/recipe/${ID}`;
});

describe('recipe card servings', () => {
  it('shows "Serves 8" and the written amounts untouched until changed (catches scaling by default)', async () => {
    mount();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('group', { name: 'Servings' })).toHaveTextContent('Serves 8');
    expect(quantities()).toEqual(['2 cups', '1/2 cup', '3/4 cup', '1/2 tsp', '2 tbsp']);
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
  });

  it('scales every amount when servings go from 8 to 12 (x1.5) (catches wrong factor or a skipped row)', async () => {
    mount();
    await screen.findByRole('heading', { level: 1 });
    for (let i = 0; i < 4; i += 1) more();
    expect(screen.getByRole('group', { name: 'Servings' })).toHaveTextContent('Serves 12');
    // 2 x 1.5 = 3; 1/2 x 1.5 = 3/4; 3/4 x 1.5 = 1 1/8; 1/2 x 1.5 = 3/4; 2 x 1.5 = 3
    expect(quantities()).toEqual(['3 cups', '¾ cup', '1⅛ cup', '¾ tsp', '3 tbsp']);
  });

  it('halves going down to 4 and Reset restores the original text and hides itself', async () => {
    mount();
    await screen.findByRole('heading', { level: 1 });
    for (let i = 0; i < 4; i += 1) fewer();
    // 3/4 x 0.5 = 0.375, nearer 1/3 than 1/4; units stay as written
    expect(quantities()).toEqual(['1 cups', '¼ cup', '⅓ cup', '¼ tsp', '1 tbsp']);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(quantities()).toEqual(['2 cups', '1/2 cup', '3/4 cup', '1/2 tsp', '2 tbsp']);
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
  });

  it('announces the number politely (catches a silent change for screen reader users)', async () => {
    mount();
    await screen.findByRole('heading', { level: 1 });
    const live = screen.getByRole('group', { name: 'Servings' }).querySelector('[aria-live="polite"]')!;
    expect(live).toHaveTextContent('Serves 8');
    more();
    expect(live).toHaveTextContent('Serves 9');
  });

  it('stops at 1 (lower bound) and does nothing further', async () => {
    mount(ID, [{ ...SAMPLE_RECIPES[0], serves: 2 }]);
    await screen.findByRole('heading', { level: 1 });
    fewer();
    fewer();
    fewer();
    expect(screen.getByRole('group', { name: 'Servings' })).toHaveTextContent('Serves 1');
    expect(screen.getByRole('button', { name: 'Fewer servings' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('stops at 100 (upper bound)', async () => {
    mount(ID, [{ ...SAMPLE_RECIPES[0], serves: 99 }]);
    await screen.findByRole('heading', { level: 1 });
    more();
    more();
    expect(screen.getByRole('group', { name: 'Servings' })).toHaveTextContent('Serves 100');
    expect(screen.getByRole('button', { name: 'More servings' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows no control and no note for a recipe without serves (catches a scaler on legacy recipes)', async () => {
    mount(NO_SERVES);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('group', { name: 'Servings' })).toBeNull();
    expect(screen.queryByText(/aren.t scaled/)).toBeNull();
  });

  describe('amounts without a number', () => {
    const recipe: Recipe = {
      ...SAMPLE_RECIPES[0],
      serves: 4,
      ingredients: [
        { quantity: '2 cups', item: 'flour' },
        { quantity: 'a pinch', item: 'salt' },
        { quantity: '', item: 'water, as needed' },
      ],
    };
    it('keeps them as written and adds one note only once servings differ (catches a note shown at the original size, or twice)', async () => {
      mount(ID, [recipe]);
      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByText("Amounts without a number aren't scaled")).toBeNull();
      more();
      expect(quantities()).toEqual(['2½ cups', 'a pinch', '']);
      expect(screen.getAllByText("Amounts without a number aren't scaled")).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      expect(screen.queryByText("Amounts without a number aren't scaled")).toBeNull();
    });

    it('shows no note when every amount has a number', async () => {
      mount();
      await screen.findByRole('heading', { level: 1 });
      more();
      expect(screen.queryByText(/aren.t scaled/)).toBeNull();
    });
  });

  it('never writes to the store: scaling is a view (catches a save with scaled quantities)', async () => {
    const store = mount();
    const save = vi.spyOn(store, 'saveRecipe');
    const hide = vi.spyOn(store, 'setHidden');
    await screen.findByRole('heading', { level: 1 });
    more();
    more();
    expect(save).not.toHaveBeenCalled();
    expect(hide).not.toHaveBeenCalled();
    expect((await store.getRecipe(ID))!.ingredients[0].quantity).toBe('2 cups');
    expect((await store.getRecipe(ID))!.serves).toBe(8);
  });

  it('remembers the choice for this visit (the handoff kitchen mode reads) and forgets it on Reset', async () => {
    mount();
    await screen.findByRole('heading', { level: 1 });
    more();
    expect(window.sessionStorage.getItem(`cookbook.servings.${ID}`)).toBe('9');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(window.sessionStorage.getItem(`cookbook.servings.${ID}`)).toBeNull();
  });

  it('opens at the servings chosen earlier in the visit (catches the card ignoring what kitchen mode left)', async () => {
    window.sessionStorage.setItem(`cookbook.servings.${ID}`, '16');
    mount();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('group', { name: 'Servings' })).toHaveTextContent('Serves 16');
    expect(quantities()[0]).toBe('4 cups');
  });
});

describe('servings control styling', () => {
  // The ruled card only works if every block is whole rule gaps, and phone taps need 44px.
  it('makes the control row two rule gaps tall inside the ruled body', () => {
    expect(css).toMatch(/\.rc-ruled \.sv-ctl\s*\{[^}]*height:\s*calc\(var\(--rule-gap\) \* 2\)/);
  });
  it('keeps the note on the rule lines (line-height is one rule gap) and uses tokens only', () => {
    expect(css).toMatch(/\.rc-note\s*\{[^}]*line-height|\.rc-note\s*\{[^}]*font:[^;}]*\/var\(--rule-gap\)/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
