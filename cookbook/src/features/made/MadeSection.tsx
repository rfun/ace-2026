import { useStore } from '../../data/StoreProvider';
import type { MadeNote, Me, Person, UserId } from '../../domain/types';
import { penFor } from '../recipe/pens';
import { Snapshot } from '../recipe/Snapshot';
import { MadeComposer } from './MadeComposer';
import './made.css';

export const MADE_EMPTY = 'Nobody has posted yet. Made it? Tell us how it went.';

export interface MadeSectionProps {
  recipeId: string;
  notes: MadeNote[];
  people: Record<UserId, Person>;
  me: Me;
  /** Called with the saved note after a successful post. */
  onPosted: (note: MadeNote) => void;
}

function dayOf(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** "I made this": what people found when they cooked it. Separate from the tips in the margin. */
export function MadeSection({ recipeId, notes, people, me, onPosted }: MadeSectionProps): JSX.Element {
  const store = useStore();
  return (
    <section aria-labelledby="rc-h-made" className="rc-sec mk-sec">
      <h2 id="rc-h-made" className="label">
        I made this
      </h2>
      {notes.length === 0 ? (
        <p className="mk-empty">{MADE_EMPTY}</p>
      ) : (
        <ul className="mk-list">
          {notes.map((note) => (
            <li key={note.id} className="mk-note">
              {note.hidden && <span className="mk-hidden-note">Hidden from others</span>}
              <p className="mk-meta">
                <span className={`mk-author pen-${penFor(note.authorId)}`}>{people[note.authorId]?.name ?? 'A colleague'}</span>
                {' · '}
                <time dateTime={new Date(note.createdAt).toISOString()}>{dayOf(note.createdAt)}</time>
              </p>
              <p className="mk-text">{note.text}</p>
              {note.photo && <Snapshot photo={note.photo} className="mk-snap" />}
              {me.canModerate && (
                <button
                  type="button"
                  className="quiet mk-hide"
                  onClick={() => void store.setHidden('made', note.id, !note.hidden)}
                >
                  {note.hidden ? 'Unhide' : 'Hide'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {me.canWrite && <MadeComposer recipeId={recipeId} onDone={onPosted} />}
    </section>
  );
}
