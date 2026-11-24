import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { StoreProvider } from '../data/StoreProvider';
import { createMockStore } from '../data/mock/mockStore';

// App owns only the header and route -> screen selection, so every feature
// screen is mocked to a unique marker. Real screens may need a store or change
// their output without affecting these tests.
vi.mock('../features/browse', () => ({ default: () => <p>screen:browse</p> }));
vi.mock('../features/recipe', () => ({ default: () => <p>screen:recipe</p> }));
vi.mock('../features/compose', () => ({ default: () => <p>screen:compose</p> }));
vi.mock('../features/kitchen', () => ({ default: () => <p>screen:kitchen</p> }));

const MARKERS = ['browse', 'recipe', 'compose', 'kitchen'] as const;

function renderApp(notice?: string) {
  return render(
    <StoreProvider store={createMockStore()}>
      <App notice={notice} />
    </StoreProvider>,
  );
}

async function goTo(hash: string): Promise<void> {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

function expectOnly(name: (typeof MARKERS)[number]): void {
  for (const m of MARKERS) {
    const el = screen.queryByText(`screen:${m}`);
    if (m === name) expect(el).toBeInTheDocument();
    else expect(el).not.toBeInTheDocument();
  }
}

describe('App shell', () => {
  beforeEach(() => {
    window.location.hash = '#/';
  });

  // Catches: the offline notice not reaching the shell, or a notice appearing when none was passed.
  it('shows the notice when given and nothing when not', () => {
    const { unmount } = renderApp();
    expect(screen.queryByRole('status')).toBeNull();
    unmount();
    renderApp("Couldn't reach the cookbook's shared storage. Reload to try again.");
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't reach the cookbook's shared storage. Reload to try again.");
  });

  // Catches: header removed or renamed.
  it('renders the header', () => {
    renderApp();
    expect(screen.getByText('ACE Culture Cookbook')).toBeInTheDocument();
  });

  // Catches: logo dropped, wrong alt, or header no longer linking home.
  it('header shows the logo with alt "ACE" and links to #/', () => {
    renderApp();
    const img = screen.getByAltText('ACE');
    expect(img.tagName).toBe('IMG');
    const link = img.closest('a');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('#/');
  });

  // Catches: header link dead (preventDefault without navigating).
  it('clicking the header goes back to browse', async () => {
    renderApp();
    await goTo('#/compose');
    expectOnly('compose');
    await act(async () => {
      screen.getByAltText('ACE').click();
    });
    expect(window.location.hash).toBe('#/');
  });

  // Catches: default route not mapping to browse.
  it('shows only browse at #/', () => {
    renderApp();
    expectOnly('browse');
  });

  // Catches: swapped/missing route branches, or a stale screen left mounted
  // after hashchange.
  it.each([
    ['#/recipe/r1', 'recipe'],
    ['#/compose', 'compose'],
    ['#/compose/r1', 'compose'],
    ['#/kitchen/r1', 'kitchen'],
  ] as const)('on hashchange to %s shows only %s', async (hash, marker) => {
    renderApp();
    expectOnly('browse');
    await goTo(hash);
    expectOnly(marker);
  });

  // Catches: route not updating on a later hashchange (listener fires once only).
  it('returns to browse after navigating away and back', async () => {
    renderApp();
    await goTo('#/kitchen/r1');
    expectOnly('kitchen');
    await goTo('#/');
    expectOnly('browse');
  });

  // Catches: the shell header (a hidden tab stop under the kitchen overlay) rendering on the kitchen route, or vanishing on the others.
  it.each([
    ['#/kitchen/r1', false],
    ['#/', true],
    ['#/recipe/r1', true],
    ['#/compose', true],
    ['#/compose/r1', true],
  ] as const)('on %s the shell header is shown: %s', async (hash, shown) => {
    renderApp();
    await goTo(hash);
    if (shown) expect(screen.getByText('ACE Culture Cookbook')).toBeInTheDocument();
    else expect(screen.queryByText('ACE Culture Cookbook')).toBeNull();
  });
});
