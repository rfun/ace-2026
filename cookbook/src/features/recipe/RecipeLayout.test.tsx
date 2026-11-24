import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
// The test runner blanks CSS imports, so read the stylesheet text from disk (tests run from cookbook/).
// @ts-ignore node types are not installed for the browser build; this runs under vitest only.
import { readFileSync } from 'node:fs';
import { StoreProvider } from '../../data/StoreProvider';
import { createMockStore } from '../../data/mock/mockStore';
import type { Me } from '../../domain/types';
import RecipeScreen from './index';

const css: string = readFileSync('src/features/recipe/recipe.css', 'utf8');
const components: string = readFileSync('src/styles/components.css', 'utf8');
const ID = 'r-besan-ladoo'; // authored by u-jordan
const AUTHOR = 'u-jordan';

function mount(me: Me) {
  return render(
    <StoreProvider store={createMockStore({ me })}>
      <RecipeScreen id={ID} />
    </StoreProvider>,
  );
}

beforeEach(() => {
  window.location.hash = `#/recipe/${ID}`;
});

describe('step order', () => {
  // Catches: the photo coming before the sentence it illustrates (reading and screen-reader order).
  it('puts each step text before its photo in the DOM', async () => {
    mount({ id: 'u-you', canWrite: true, canModerate: false });
    const steps = within((await screen.findByRole('heading', { name: 'Steps' })).closest('section')!).getAllByRole('listitem');
    const withPhoto = steps.filter((li) => li.querySelector('figure'));
    expect(withPhoto.length).toBeGreaterThan(0);
    for (const li of withPhoto) {
      const text = li.querySelector('.rc-step-text')!;
      const fig = li.querySelector('figure')!;
      expect(text.compareDocumentPosition(fig) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe('wayfinding tabs', () => {
  // Catches: the three meta labels still being links or tabs, or the back link being lost.
  it('keeps exactly one link in the location nav; origin and course are plain text', async () => {
    mount({ id: 'u-you', canWrite: true, canModerate: false });
    const nav = await screen.findByRole('navigation', { name: 'Recipe location' });
    expect(within(nav).getAllByRole('link')).toHaveLength(1);
    expect(within(nav).getByRole('link')).toHaveTextContent('All recipes');
    const origin = within(nav).getByText('Punjab, India');
    expect(origin.tagName).toBe('SPAN');
    expect(origin).not.toHaveAttribute('href');
    expect(within(nav).getByText('Sweets').closest('a')).toBeNull();
  });
});

describe('Edit this card', () => {
  const edit = () => screen.queryByRole('button', { name: 'Edit this card' });

  // Catches: author cannot reach their own edit screen, or Edit navigates to the wrong route.
  it('shows to the author and opens compose for this recipe', async () => {
    mount({ id: AUTHOR, canWrite: true, canModerate: false });
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(edit()!);
    expect(window.location.hash).toBe(`#/compose/${ID}`);
  });

  // Catches: moderators locked out of editing.
  it('shows to a moderator who is not the author', async () => {
    mount({ id: 'u-mod', canWrite: true, canModerate: true });
    await screen.findByRole('heading', { level: 1 });
    expect(edit()).not.toBeNull();
  });

  // Catches: any signed-in reader seeing Edit on other people's cards.
  it('is hidden from a writer who is neither author nor moderator', async () => {
    mount({ id: 'u-you', canWrite: true, canModerate: false });
    await screen.findByRole('heading', { level: 1 });
    expect(edit()).toBeNull();
  });

  // Catches: the canWrite gate being dropped for the author.
  it('is hidden from the author when they cannot write', async () => {
    mount({ id: AUTHOR, canWrite: false, canModerate: false });
    await screen.findByRole('heading', { level: 1 });
    expect(edit()).toBeNull();
  });

  // Catches: the canWrite gate being dropped for a moderator.
  it('is hidden from a moderator when they cannot write', async () => {
    mount({ id: 'u-mod', canWrite: false, canModerate: true });
    await screen.findByRole('heading', { level: 1 });
    expect(edit()).toBeNull();
  });

  // Catches: the edit button losing the shared 44px quiet style.
  it('uses the shared 44px quiet button', async () => {
    mount({ id: AUTHOR, canWrite: true, canModerate: false });
    await screen.findByRole('heading', { level: 1 });
    expect(edit()).toHaveClass('quiet');
    expect(/\.quiet \{[^}]*min-height: 44px/.test(components)).toBe(true);
  });
});

describe('pen-stroke reveal', () => {
  // Catches: no reveal on a new tip, or the reveal marking old tips too.
  it('marks only the newly pinned tip', async () => {
    mount({ id: 'u-you', canWrite: true, canModerate: false });
    await screen.findByRole('heading', { level: 1 });
    expect(document.querySelectorAll('.rc-tip-new')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '+ Add your tip' }));
    fireEvent.change(await screen.findByLabelText('Your tip'), { target: { value: 'A brand new tip' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pin it to the card' }));
    await waitFor(() => expect(screen.getByText('A brand new tip')).toBeInTheDocument());
    const fresh = document.querySelectorAll('.rc-tip-new');
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).toHaveTextContent('A brand new tip');
  });

  // Catches: wrong duration, wrong clip-path direction, or no reduced-motion opt-out.
  it('animates a 700ms clip-path left to right and is off under prefers-reduced-motion', () => {
    expect(css).toMatch(/\.rc-tip-new \.rc-hand \{ animation: rc-pen 700ms ease-out/);
    expect(css).toMatch(/@keyframes rc-pen \{ from \{ clip-path: inset\(0 100% 0 0\); \} to \{ clip-path: inset\(0 0 0 0\); \}/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.rc-tip-new \.rc-hand \{ animation: none; \} \}/);
  });
});

describe('tip composer width', () => {
  // Catches: the composer staying in the 260px column at desktop widths.
  it('flags the ruled card as composing and the CSS spans the margin across the grid at >=1024px', async () => {
    mount({ id: 'u-you', canWrite: true, canModerate: false });
    await screen.findByRole('heading', { level: 1 });
    expect(document.querySelector('.rc-ruled')).not.toHaveClass('rc-composing');
    fireEvent.click(screen.getByRole('button', { name: '+ Add your tip' }));
    expect(document.querySelector('.rc-ruled')).toHaveClass('rc-composing');
    expect(css).toMatch(/@media \(min-width: 1024px\) \{\s*\.rc-composing \.rc-margin \{ grid-column: 1 \/ -1;/);
  });
});
