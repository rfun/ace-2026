import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
// @ts-ignore node types are not installed for the browser build; this runs under vitest only.
import { readFileSync } from 'node:fs';
import { StoreProvider } from '../../data/StoreProvider';
import { createMockStore } from '../../data/mock/mockStore';
import KitchenScreen from './index';

const css: string = readFileSync('src/features/kitchen/kitchen.css', 'utf8');
const ID = 'r-besan-ladoo'; // 5 steps

async function ready() {
  render(
    <StoreProvider store={createMockStore()}>
      <KitchenScreen id={ID} />
    </StoreProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
}

const next = () => fireEvent.keyDown(window, { key: 'ArrowRight' });

beforeEach(() => {
  window.location.hash = '#/kitchen/' + ID;
  window.sessionStorage.clear();
});

describe('kitchen structure', () => {
  function expectTitleH1() {
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent('Besan Ladoo');
    expect(h1s[0]).toHaveClass('sr-only');
  }

  // Catches: the recipe title missing from the gather card.
  it('gather card: sr-only h1 title plus a visible h2 "Gather the ingredients"', async () => {
    await ready();
    expectTitleH1();
    const h2 = screen.getByRole('heading', { level: 2, name: 'Gather the ingredients' });
    expect(h2).not.toHaveClass('sr-only');
  });

  // Catches: the step staying the page h1, or the title vanishing from step cards.
  it('step card: sr-only h1 title and the step text as h2', async () => {
    await ready();
    next();
    expectTitleH1();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Melt the ghee');
  });

  // Catches: the title vanishing from the done card.
  it('done card: sr-only h1 title and an h2 "All done. Enjoy!"', async () => {
    await ready();
    for (let i = 0; i < 6; i += 1) next();
    expectTitleH1();
    expect(screen.getByRole('heading', { level: 2, name: 'All done. Enjoy!' })).toBeInTheDocument();
  });

  // Catches: eyebrow kickers returning, or Step n of N turning back into a styled label/heading.
  it('has no kicker eyebrows and shows Step n of N as a plain paragraph', async () => {
    await ready();
    expect(document.querySelector('.kt-kicker')).toBeNull();
    expect(screen.queryByText('Gather')).toBeNull();
    next();
    const progress = screen.getByText('Step 1 of 5');
    expect(progress.tagName).toBe('P');
    expect(progress).not.toHaveClass('label');
  });

  // Catches: text drifting off the 48px rules (gap not set on the card, or line heights not following it).
  it('sets --rule-gap 48px on the card and sizes line heights from it', () => {
    expect(/\.kt-card \{[^}]*--rule-gap: 48px/.test(css)).toBe(true);
    // jsdom has no layout, so geometry cannot be measured here; the 48px pitch is measured in CDP screenshots (see report).
    // The gather row must not grow its line box: inline qty top-aligned, text span on the rule gap, no row padding/margin.
    expect(/\.kt-qty \{[^}]*vertical-align: top/.test(css)).toBe(true);
    expect(/\.kt-ing-text \{[^}]*line-height: var\(--rule-gap\)/.test(css)).toBe(true);
    expect(/\.kt-check \{[^}]*min-height: var\(--rule-gap\); padding: 0;/.test(css)).toBe(true);
    for (const sel of ['kt-title', 'kt-step', 'kt-text', 'kt-progress', 'kt-check']) {
      expect(css).toMatch(new RegExp(`\\.${sel} \\{[^}]*var\\(--rule-gap\\)`));
    }
  });
});
