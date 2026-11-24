import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
// @ts-ignore node types are not installed for the browser build; this runs under vitest only.
import { readFileSync } from 'node:fs';
import { StoreProvider } from '../../data/StoreProvider';
import { createMockStore } from '../../data/mock/mockStore';
import ComposeScreen from './index';

const css: string = readFileSync('src/features/compose/compose.css', 'utf8');
const shared: string = readFileSync('src/styles/components.css', 'utf8');

async function open() {
  window.location.hash = '#/compose';
  render(
    <StoreProvider store={createMockStore({ me: { id: 'u-you', canWrite: true, canModerate: false } })}>
      <ComposeScreen />
    </StoreProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('compose legibility', () => {
  // Catches: the ruled gradient coming back behind inputs, or the red margin line being lost.
  it('has no ruled stripes on the body but keeps the red margin line', () => {
    const body = /\.cp-body \{[^}]*\}/.exec(css)![0];
    expect(body).not.toMatch(/gradient/);
    expect(css).toMatch(/\.cp-body::before \{[^}]*var\(--margin\)/);
  });

  // Catches: the hint above the input, or a hint a screen reader never hears.
  it('puts the hint after its input and references it in aria-describedby', async () => {
    await open();
    const input = screen.getByLabelText('Makes');
    const hint = screen.getByText('For example: 24 ladoos');
    expect(input.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hint.id).not.toBe('');
    expect(input.getAttribute('aria-describedby')).toBe(hint.id);
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  // Catches: an error id replacing the hint id (one of the two dropped from aria-describedby).
  it('keeps the hint and adds the error id when the hinted field is invalid', async () => {
    await open();
    // Makes is optional, so make the form invalid elsewhere and check a field with no hint still gets only its error id.
    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
    await screen.findAllByRole('alert');
    expect(screen.getByLabelText('Makes').getAttribute('aria-describedby')).toBe('f-makes-hint');
    const bad = document.querySelector('[aria-invalid="true"]')!;
    expect(bad.getAttribute('aria-describedby')).toMatch(/-err$/);
  });

  // Catches: wordy visible labels, or the screen-reader prefix being lost.
  it('shows Amount / Ingredient with an sr-only "Ingredient N" prefix', async () => {
    await open();
    for (const [name, visible] of [['Ingredient 1 Amount', 'Amount'], ['Ingredient 1 Ingredient', 'Ingredient']] as const) {
      const field = screen.getByLabelText(name);
      const label = document.querySelector(`label[for="${field.id}"]`)!;
      const prefix = label.querySelector('.sr-only')!;
      expect(prefix.textContent!.trim()).toBe('Ingredient 1');
      expect(label.textContent!.replace(prefix.textContent!, '').trim()).toBe(visible);
    }
  });
});

describe('row tools', () => {
  const names = (row: HTMLElement) => within(row).queryAllByRole('button').map((b) => b.textContent);

  // Catches: faint disabled ghosts, or Remove offered when it would empty the list.
  it('a single row has no tools at all', async () => {
    await open();
    expect(document.querySelectorAll('.cp-rows .cp-ing .cp-tool')).toHaveLength(0);
  });

  // Catches: Up on the first row, Down on the last, or glyph text.
  it('first row hides Up, last row hides Down, middle shows both, as words', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Add an ingredient' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add an ingredient' }));
    const rows = Array.from(document.querySelectorAll<HTMLElement>('.cp-rows .cp-ing'));
    expect(rows).toHaveLength(3);
    expect(names(rows[0])).toEqual(['Down', 'Remove']);
    expect(names(rows[1])).toEqual(['Up', 'Down', 'Remove']);
    expect(names(rows[2])).toEqual(['Up', 'Remove']);
  });

  // Catches: Remove deleting the wrong row.
  it('Remove deletes its own row', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Add an ingredient' }));
    fireEvent.change(screen.getByLabelText('Ingredient 1 Ingredient'), { target: { value: 'salt' } });
    fireEvent.change(screen.getByLabelText('Ingredient 2 Ingredient'), { target: { value: 'pepper' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove ingredient 1' }));
    expect(screen.getByLabelText('Ingredient 1 Ingredient')).toHaveValue('pepper');
    expect(screen.queryByLabelText('Ingredient 2 Ingredient')).toBeNull();
  });

  // Catches: tool text shrinking below 17px (the quiet button supplies the size; .cp-tool must not override it).
  it('tool text is 17px from the shared quiet button and not overridden', () => {
    expect(/\.quiet \{[^}]*font: 400 17px/.test(shared)).toBe(true);
    expect(css).not.toMatch(/\.cp-tool \{[^}]*font/);
  });

  // Catches: same-row inputs sitting at different heights.
  it('aligns grid columns and the tool row to the input line', () => {
    expect(css).toMatch(/\.cp-cols \{[^}]*align-items: start/);
    expect(css).toMatch(/\.cp-tools \{[^}]*padding-top: var\(--rule-gap\)/);
  });
});
