import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoreProvider } from '../../data/StoreProvider';
import type { DataStore } from '../../data/store';
import { createMockStore } from '../../data/mock/mockStore';
import type { MadeNote, Me, Recipe } from '../../domain/types';
import BrowseScreen from './index';

const writer: Me = { id: 'u-you', canWrite: true, canModerate: false };
const reader: Me = { id: 'u-you', canWrite: false, canModerate: false };
const DAY = 86_400_000;

function rec(id: string, title: string, ageDays: number, authorId = 'u-sam'): Recipe {
  return {
    id, title, authorId, origin: 'Somewhere', occasions: [], course: 'main', dietary: [], story: '',
    ingredients: [], steps: [], createdAt: Date.now() - ageDays * DAY, updatedAt: 0,
  };
}
const note = (recipeId: string, authorId: string, n: number): MadeNote => ({ id: `${recipeId}-${authorId}-${n}`, recipeId, authorId, text: 'yum', createdAt: 1 });

// ages: Alpha 20d, Bravo 10d, Charlie 3d (new), Delta 1d (new, mine)
const RECIPES = [rec('a', 'Alpha', 20), rec('b', 'Bravo', 10), rec('c', 'Charlie', 3), rec('d', 'Delta', 1, 'u-you')];
const SHELVES = { 'u-you': { want: ['a'], made: ['b'] }, 'u-sam': { want: ['a'], made: [] }, 'u-lee': { want: [], made: [] } };
const MADE = [note('a', 'u-sam', 1), note('a', 'u-lee', 1), note('b', 'u-sam', 1)];

function store(over: Partial<Parameters<typeof createMockStore>[0]> = {}): DataStore {
  return createMockStore({ me: writer, recipes: RECIPES, shelves: SHELVES, made: MADE, ...over });
}
function mount(s: DataStore) {
  return render(
    <StoreProvider store={s}>
      <BrowseScreen />
    </StoreProvider>,
  );
}
const titles = () => screen.getAllByRole('link').map((a) => a.textContent);
const press = (name: string) => fireEvent.click(screen.getAllByRole('button', { name })[0]);
const card = (title: string) => screen.getByText(title).closest<HTMLElement>('.bw-card')!;

beforeEach(() => {
  window.location.hash = '#/';
});

describe('My shelf filters', () => {
  // Catches: Want to make not filtering, or reading the made list.
  it('Want to make shows only my want list', async () => {
    mount(store());
    await screen.findByText('Alpha');
    press('Want to make');
    expect(titles()).toEqual(['Alpha']);
  });
  // Catches: Made it mixed up with want.
  it('Made it shows only my made list', async () => {
    mount(store());
    await screen.findByText('Alpha');
    press('Made it');
    expect(titles()).toEqual(['Bravo']);
  });
  // Catches: Not tried including listed recipes.
  it('Not tried shows recipes on neither list', async () => {
    mount(store());
    await screen.findByText('Alpha');
    press('Not tried');
    expect(titles()).toEqual(['Delta', 'Charlie']);
  });
  // Catches: shelf group allowing two choices at once (it is single choice) and toggle-off not clearing.
  it('shelf choice is single and toggles off', async () => {
    mount(store());
    await screen.findByText('Alpha');
    press('Want to make');
    press('Made it');
    expect(titles()).toEqual(['Bravo']);
    expect(screen.getAllByRole('button', { name: 'Made it' })[0]).toHaveAttribute('aria-pressed', 'true');
    press('Made it');
    expect(titles()).toHaveLength(4);
  });
  // Catches: the new filters not combining with each other or the active-filter chips.
  it('My recipes and New this week combine with the shelf group', async () => {
    mount(store());
    await screen.findByText('Alpha');
    press('My recipes');
    expect(titles()).toEqual(['Delta']);
    press('My recipes');
    press('New this week');
    expect(titles()).toEqual(['Delta', 'Charlie']);
    press('Not tried');
    expect(titles()).toEqual(['Delta', 'Charlie']);
    press('Want to make');
    expect(screen.getByText('No cards match these filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove filter New this week' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(titles()).toHaveLength(4);
  });
  // Catches: shelf group first in the panel (spec) and the phone quick chip being absent.
  it('puts My shelf first in the filter panel and offers a Want to make quick chip outside it', async () => {
    mount(store());
    await screen.findByText('Alpha');
    const panel = document.getElementById('bw-filters')!;
    expect(panel.querySelector('legend')!.textContent).toBe('My shelf');
    const quick = document.querySelector('.bw-quick')!;
    fireEvent.click(within(quick as HTMLElement).getByRole('button', { name: 'Want to make' }));
    expect(titles()).toEqual(['Alpha']);
    expect(within(panel).getByRole('button', { name: 'Want to make' })).toHaveAttribute('aria-pressed', 'true');
  });
  // Catches: a read-only viewer seeing shelf controls that cannot work.
  it('is hidden for a viewer who cannot write', async () => {
    mount(store({ me: reader }));
    await screen.findByText('Alpha');
    expect(screen.queryByText('My shelf')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Want to make' })).toBeNull();
    expect(document.querySelector('.bw-quick')).toBeNull();
    expect(card('Alpha').querySelector('.bw-mark')).toBeNull();
    expect(titles()).toHaveLength(4);
  });
});

describe('card badges', () => {
  // Catches: wrong count, count shown at 0, or badge missing.
  it('shows Made by N only when N is at least 1', async () => {
    mount(store());
    await screen.findByText('Alpha');
    expect(card('Alpha')).toHaveTextContent('Made by 2');
    expect(card('Bravo')).toHaveTextContent('Made by 2');
    expect(card('Charlie').textContent).not.toMatch(/Made by/);
  });
  // Catches: New shown for old recipes or missing for fresh ones.
  it('shows New only within 7 days', async () => {
    mount(store());
    await screen.findByText('Alpha');
    expect(card('Charlie').querySelector('.bw-badge')).toHaveTextContent('New');
    expect(card('Delta')).toHaveTextContent('New');
    expect(card('Bravo').textContent).not.toMatch(/\bNew\b/);
  });
  // Catches: shelf state conveyed by colour only, or made/want swapped.
  it('marks my own shelf state in text', async () => {
    mount(store());
    await screen.findByText('Alpha');
    expect(card('Alpha')).toHaveTextContent('On your list');
    expect(card('Bravo')).toHaveTextContent('You made this');
    expect(card('Charlie').querySelector('.bw-mark')).toBeNull();
  });
});

describe('Most made sort', () => {
  // Catches: Newest not the default.
  it('defaults to newest', async () => {
    mount(store());
    await screen.findByText('Alpha');
    expect(titles()).toEqual(['Delta', 'Charlie', 'Bravo', 'Alpha']);
    expect(screen.getAllByRole('button', { name: 'Newest' })[0]).toHaveAttribute('aria-pressed', 'true');
  });
  // Catches: sort ignoring made counts, or wantCount/newest tiebreaks wrong (Charlie and Delta tie at 0/0, newest first).
  it('Most made orders by made, then wants, then newest', async () => {
    mount(store());
    await screen.findByText('Alpha');
    press('Most made');
    expect(titles()).toEqual(['Alpha', 'Bravo', 'Delta', 'Charlie']);
  });
  // Catches: the sort choice being lost when the store pushes an update (state reset on reload).
  it('keeps the choice across a store refresh', async () => {
    const s = store();
    mount(s);
    await screen.findByText('Alpha');
    press('Most made');
    await s.setShelf('c', 'want'); // triggers subscribe
    await waitFor(() => expect(card('Charlie')).toHaveTextContent('On your list'));
    expect(titles()[0]).toBe('Alpha');
    expect(screen.getAllByRole('button', { name: 'Most made' })[0]).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('stats and shelf failure', () => {
  // Catches: a failing stats call blanking the page, leaving badges, or breaking Most made.
  it('still browses without badges when stats fail, and Most made falls back to newest', async () => {
    const s = store();
    s.stats = () => Promise.reject(new Error('boom'));
    mount(s);
    await screen.findByText('Alpha');
    expect(titles()).toHaveLength(4);
    expect(document.body.textContent).not.toMatch(/Made by/);
    press('Most made');
    expect(titles()).toEqual(['Delta', 'Charlie', 'Bravo', 'Alpha']);
    expect(card('Alpha')).toHaveTextContent('On your list'); // shelf still loaded
  });
  // Catches: a failing shelf call blanking the page or leaving a shelf filter that would show everything as Not tried.
  it('hides shelf UI when the shelf fails but still shows stats', async () => {
    const s = store();
    s.myShelf = () => Promise.reject(new Error('boom'));
    mount(s);
    await screen.findByText('Alpha');
    expect(screen.queryByText('My shelf')).toBeNull();
    expect(card('Alpha')).toHaveTextContent('Made by 2');
    expect(titles()).toHaveLength(4);
  });
  // Catches: stats data refreshing only on first load (badges stale after another user acts).
  it('refreshes badges on a store update', async () => {
    const s = store();
    mount(s);
    await screen.findByText('Alpha');
    expect(card('Charlie').textContent).not.toMatch(/Made by/);
    await s.addMade('c', { text: 'made it' });
    await waitFor(() => expect(card('Charlie')).toHaveTextContent('Made by 1'));
    expect(card('Charlie')).toHaveTextContent('You made this');
  });
});
