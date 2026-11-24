import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { navigate } from './router';

describe('App shell', () => {
  it('renders the header and the stub for the current route, updating on hashchange', async () => {
    window.location.hash = '#/';
    render(<App />);
    expect(screen.getByText('ACE Culture Cookbook')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Browse' })).toBeInTheDocument();
    await act(async () => {
      navigate({ name: 'kitchen', id: 'r1' });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('heading', { name: 'Kitchen' })).toBeInTheDocument();
  });
});
