import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreProvider } from '../../data/StoreProvider';
import type { DataStore } from '../../data/store';
import { createMockStore } from '../../data/mock/mockStore';
import KitchenScreen from './index';

const ID = 'r-besan-ladoo'; // 5 ingredients, 5 steps (see samples)

function mount(store: DataStore, id = ID) {
  return render(
    <StoreProvider store={store}>
      <KitchenScreen id={id} />
    </StoreProvider>,
  );
}

async function ready(id = ID) {
  mount(createMockStore());
  await screen.findByRole('heading', { level: 1 });
  return id;
}

function setWakeLock(value: unknown) {
  Object.defineProperty(navigator, 'wakeLock', { value, configurable: true });
}

beforeEach(() => {
  window.location.hash = '#/kitchen/' + ID;
  window.sessionStorage.clear();
});
afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).wakeLock;
  vi.restoreAllMocks();
});

describe('KitchenPage', () => {
  it('first card lists every ingredient as a checkbox (catches a Gather card that drops ingredients)', async () => {
    await ready();
    expect(screen.getByRole('heading', { level: 2, name: 'Gather the ingredients' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
    expect(screen.getByText('besan (gram flour)')).toBeInTheDocument();
  });

  it('checking an ingredient toggles only local state (catches checkboxes that are not controlled)', async () => {
    await ready();
    const box = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    expect((screen.getAllByRole('checkbox')[1] as HTMLInputElement).checked).toBe(false);
  });

  it('Previous is disabled on the first card (catches navigating before the start)', async () => {
    await ready();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('heading', { level: 2, name: 'Gather the ingredients' })).toBeInTheDocument();
  });

  it('Next shows "Step 1 of 5" with the step text, and announces it politely (catches wrong numbering or a missing live region)', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Melt the ghee in a heavy pan over low heat.');
    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('Showing step 1 of 5');
  });

  it('ArrowRight/PageDown advance and ArrowLeft/PageUp go back (catches a missing key binding)', async () => {
    await ready();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'PageDown' });
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'PageUp' });
    expect(screen.getByRole('heading', { level: 2, name: 'Gather the ingredients' })).toBeInTheDocument();
  });

  it('swipes need 50px: 60px left advances, 30px does not, 60px right goes back (catches a wrong threshold or direction)', async () => {
    await ready();
    const card = () => document.querySelector('.kt-card') as HTMLElement;
    fireEvent.pointerDown(card(), { clientX: 200 });
    fireEvent.pointerUp(card(), { clientX: 140 });
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    fireEvent.pointerDown(card(), { clientX: 200 });
    fireEvent.pointerUp(card(), { clientX: 170 });
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    fireEvent.pointerDown(card(), { clientX: 100 });
    fireEvent.pointerUp(card(), { clientX: 160 });
    expect(screen.getByRole('heading', { level: 2, name: 'Gather the ingredients' })).toBeInTheDocument();
  });

  it('last step offers Done, which reaches the Done card whose button goes to #/recipe/<id> (catches a dead end at the end)', async () => {
    await ready();
    for (let i = 0; i < 5; i++) fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to the recipe' }));
    expect(window.location.hash).toBe('#/recipe/' + ID);
  });

  it('keys cannot run past the Done card (catches an unclamped index)', async () => {
    await ready();
    for (let i = 0; i < 12; i++) fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'Back to the recipe' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Recipe finished');
  });

  it('unknown id shows the tin message and a link to all recipes (catches a blank or crashing screen)', async () => {
    mount(createMockStore(), 'nope');
    expect(await screen.findByText("This card isn't in the tin.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Back to all recipes' }));
    expect(window.location.hash).toBe('#/');
  });

  it('Close returns to the recipe at any time (catches a trapped kitchen screen)', async () => {
    await ready();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('link', { name: /Close/ }));
    expect(window.location.hash).toBe('#/recipe/' + ID);
  });

  it('a recipe with zero steps goes Gather then Done (catches an off-by-one on empty steps)', async () => {
    const store = createMockStore();
    const recipe = await store.getRecipe(ID);
    const base = { ...recipe!, steps: [] };
    const stub: DataStore = { ...store, getRecipe: async () => base };
    mount(stub);
    await screen.findByRole('heading', { level: 2, name: 'Gather the ingredients' });
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Back to the recipe' })).toBeInTheDocument();
  });

  it('requests a screen wake lock and releases it on unmount (catches a leaked lock)', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    setWakeLock({ request });
    const { unmount } = mount(createMockStore());
    await screen.findByRole('heading', { level: 1 });
    expect(request).toHaveBeenCalledWith('screen');
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    unmount();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('re-requests the wake lock when the page becomes visible again and survives a rejection (catches a lock lost after tab switch)', async () => {
    const request = vi.fn().mockRejectedValue(new Error('denied'));
    setWakeLock({ request });
    mount(createMockStore());
    await screen.findByRole('heading', { level: 1 });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('works with no wake lock API (catches a crash on browsers without it)', async () => {
    await ready();
    expect(screen.getByRole('heading', { level: 2, name: 'Gather the ingredients' })).toBeInTheDocument();
  });

  it('restores the saved card from sessionStorage per recipe id (catches losing place on reload)', async () => {
    window.sessionStorage.setItem('cookbook.kitchen.' + ID, '3');
    await ready();
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
  });

  it('writes the position as the cook moves and ignores another recipe\'s position (catches a shared or unsaved key)', async () => {
    window.sessionStorage.setItem('cookbook.kitchen.other', '4');
    await ready();
    expect(screen.getByRole('heading', { level: 2, name: 'Gather the ingredients' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(window.sessionStorage.getItem('cookbook.kitchen.' + ID)).toBe('1');
  });

  it('clamps an out-of-range saved position (catches a blank card after a recipe lost steps)', async () => {
    window.sessionStorage.setItem('cookbook.kitchen.' + ID, '99');
    await ready();
    expect(screen.getByRole('button', { name: 'Back to the recipe' })).toBeInTheDocument();
  });

  it('survives sessionStorage throwing (catches an unguarded storage access)', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await ready();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });
});
