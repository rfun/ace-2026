import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../data/StoreProvider';
import type { RecipeStats, ShelfState } from '../../domain/types';
import { adjustStats, countLine } from './counts';
import './made.css';

export interface ShelfButtonsProps {
  recipeId: string;
  /** What the store last said about this person and this recipe. */
  state: ShelfState;
  /** The store's counts, which already include `state`. */
  stats: RecipeStats;
  canWrite: boolean;
}

/**
 * "Want to make" / "Made it": a pair of toggles (one at a time; pressing the pressed one clears it)
 * plus a quiet count line. Updates at once and goes back with a short message if the save fails.
 * The shelf itself is private: only counts are ever shown, never names.
 */
export function ShelfButtons({ recipeId, state, stats, canWrite }: ShelfButtonsProps): JSX.Element | null {
  const store = useStore();
  /** What the buttons show while a save is in flight; null means "whatever the store said". */
  const [pending, setPending] = useState<ShelfState | null>(null);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  // A fresh answer from the store replaces the optimistic one.
  useEffect(() => { setPending(null); }, [state, recipeId]);

  const shown = pending ?? state;
  const line = countLine(adjustStats(stats, state, shown));

  function press(target: 'want' | 'made') {
    if (saving.current) return;
    const next: ShelfState = shown === target ? 'none' : target;
    saving.current = true;
    setError('');
    setPending(next);
    store.setShelf(recipeId, next).then(
      () => { saving.current = false; },
      () => {
        saving.current = false;
        if (!alive.current) return;
        setPending(null);
        setError("Couldn't save that. Try again.");
      },
    );
  }

  if (!canWrite && !line) return null;
  return (
    <div className="mk-shelf">
      {canWrite && (
        <div className="mk-toggles" role="group" aria-label="Your shelf">
          <button type="button" className="mk-toggle" aria-pressed={shown === 'want'} onClick={() => press('want')}>
            Want to make
          </button>
          <button type="button" className="mk-toggle" aria-pressed={shown === 'made'} onClick={() => press('made')}>
            Made it
          </button>
        </div>
      )}
      {error && <p className="mk-error" role="alert">{error}</p>}
      {line && <p className="mk-count">{line}</p>}
    </div>
  );
}
