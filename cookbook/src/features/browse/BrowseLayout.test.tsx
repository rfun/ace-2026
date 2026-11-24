import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
// @ts-ignore node types are not installed for the browser build; this runs under vitest only.
import { readFileSync } from 'node:fs';
import { StoreProvider } from '../../data/StoreProvider';
import { createMockStore } from '../../data/mock/mockStore';
import BrowseScreen from './index';

const css: string = readFileSync('src/features/browse/browse.css', 'utf8');

async function open() {
  render(
    <StoreProvider store={createMockStore({ me: { id: 'u-you', canWrite: true, canModerate: false } })}>
      <BrowseScreen />
    </StoreProvider>,
  );
  await screen.findByText('Besan Ladoo');
}

beforeEach(() => {
  window.location.hash = '#/';
});

describe('browse cards', () => {
  // Catches: title padding applied to every card (ragged titles) or missing on photo cards (title under the snapshot).
  it('marks only cards that have a photo', async () => {
    await open();
    const ladoo = screen.getByText('Besan Ladoo').closest('a')!; // has a main photo
    const empanadas = screen.getByText('Sample Baked Empanadas').closest('a')!; // none
    expect(ladoo.querySelector('figure')).not.toBeNull();
    expect(ladoo).toHaveClass('bw-has-photo');
    expect(empanadas.querySelector('figure')).toBeNull();
    expect(empanadas).not.toHaveClass('bw-has-photo');
  });

  // Catches: the snapshot back in flow, title background painting over rules, padding on all titles.
  it('positions the snapshot top-right, keeps rules unbroken and pads titles only with a photo', () => {
    expect(css).toMatch(/\.bw-card > \.bw-snap \{[^}]*position: absolute; right: 20px; top: 14px/);
    expect(/^\.bw-title \{[^}]*\}/m.exec(css)![0]).not.toMatch(/background/);
    expect(css).toMatch(/\.bw-card\.bw-has-photo > \.bw-title \{ padding-right: 140px; min-height: 96px; \}/);
    expect(css).not.toMatch(/^\.bw-title \{[^}]*padding-right/m);
  });
});

describe('filters disclosure', () => {
  // Catches: Course chips hidden inside the disclosure, or other groups left inline.
  it('keeps only the Course group inline; the rest are inside the Filters panel', async () => {
    await open();
    const panel = document.getElementById('bw-filters')!;
    const inline = document.querySelector('.bw-course-row') as HTMLElement;
    expect(within(inline).getByText('Course')).toBeInTheDocument();
    expect(within(inline).queryByText('Dietary')).toBeNull();
    expect(panel.contains(inline)).toBe(false);
    expect(within(panel).queryByText('Course')).toBeNull();
    for (const g of ['Dietary', 'Origin', 'Occasion', 'Contributor']) expect(within(panel).getByText(g)).toBeInTheDocument();
  });

  // Catches: the disclosure toggle being phone-only, or not wired to the panel.
  it('shows the Filters (n) toggle at every width and toggles the panel open class', async () => {
    await open();
    const toggle = screen.getByRole('button', { name: 'Filters (0)' });
    const panel = document.getElementById('bw-filters')!;
    expect(toggle).toHaveAttribute('aria-controls', 'bw-filters');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(panel).not.toHaveClass('bw-filters-open');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toHaveClass('bw-filters-open');
    // desktop: panel hidden by default in CSS, toggle not hidden outside the phone block
    expect(/\.bw-filters \{[^}]*display: none/.test(css)).toBe(true);
    expect(/\.bw-toggle \{ display: inline-flex; \}/.test(css)).toBe(true);
  });

  // Catches: the count not including an inline Course selection.
  it('counts a Course chip chosen inline in the toggle', async () => {
    await open();
    fireEvent.click(within(document.querySelector('.bw-course-row') as HTMLElement).getByRole('button', { name: /Sweets/ }));
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
  });
});
