import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoreProvider } from '../../data/StoreProvider';
import { createMockStore } from '../../data/mock/mockStore';
import { consumeMadeComposerRequest } from '../made';
import KitchenScreen from './index';

const ID = 'r-besan-ladoo'; // 5 steps

beforeEach(() => {
  window.location.hash = '#/kitchen/' + ID;
  window.sessionStorage.clear();
  consumeMadeComposerRequest();
});

async function open() {
  render(
    <StoreProvider store={createMockStore()}>
      <KitchenScreen id={ID} />
    </StoreProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
}
const next = () => fireEvent.click(screen.getByRole('button', { name: /^(Next|Done)$/ }));

describe('kitchen "Made it?" link', () => {
  it('appears only on the final card (catches nagging on every step)', async () => {
    await open();
    for (let i = 0; i < 5; i += 1) {
      expect(screen.queryByText('Made it? Tell us how it went')).toBeNull(); // gather + steps 1..4
      next();
    }
    expect(screen.queryByText('Made it? Tell us how it went')).toBeNull(); // step 5, the last step itself
    next();
    expect(screen.getByRole('status')).toHaveTextContent('Recipe finished');
    expect(screen.getByText('Made it? Tell us how it went')).toBeInTheDocument();
  });

  it('goes back to the recipe and asks for the composer (catches a link that lands on the top of the page)', async () => {
    await open();
    for (let i = 0; i < 6; i += 1) next();
    const link = screen.getByRole('link', { name: 'Made it? Tell us how it went' });
    expect(link).toHaveAttribute('href', '#/recipe/' + ID);
    fireEvent.click(link);
    expect(window.location.hash).toBe('#/recipe/' + ID);
    expect(consumeMadeComposerRequest()).toBe(true);
  });
});
