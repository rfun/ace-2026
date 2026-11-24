import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { formatHash, navigate } from '../../app/router';
import { useStore } from '../../data/StoreProvider';
import { COURSES, DIETARY } from '../../domain/tags';
import type { Me, Person, Photo, Recipe, Tip, UserId } from '../../domain/types';
import { penFor } from './pens';
import './recipe.css';

type Loaded =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; recipe: Recipe; tips: Tip[]; people: Record<UserId, Person>; me: Me };

function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function goBrowse(e: MouseEvent): void {
  e.preventDefault();
  navigate({ name: 'browse' });
}

function Snapshot(props: { photo: Photo; className: string }): JSX.Element {
  return (
    <figure className={`rc-snap ${props.className}`}>
      <img src={props.photo.url} alt={props.photo.alt} loading="lazy" />
    </figure>
  );
}

function BackTab(): JSX.Element {
  return (
    <a className="rc-tab rc-tab-back" href={formatHash({ name: 'browse' })} onClick={goBrowse}>
      <span aria-hidden="true" className="rc-arrow">
        {'← '}
      </span>
      All recipes
    </a>
  );
}

function Shell(props: { tabs: JSX.Element; children: JSX.Element; busy?: boolean }): JSX.Element {
  return (
    <div className="rc-ground" aria-busy={props.busy ? true : undefined}>
      <nav className="rc-tabs" aria-label="Recipe location">
        {props.tabs}
      </nav>
      {props.children}
    </div>
  );
}

export default function RecipePage(props: { id: string; onAddTip?: () => void }): JSX.Element {
  const store = useStore();
  const { id, onAddTip } = props;
  const [data, setData] = useState<Loaded>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setData({ status: 'loading' });
    async function load(): Promise<void> {
      const [recipe, tips, me] = await Promise.all([store.getRecipe(id), store.listTips(id), store.me()]);
      if (cancelled) return;
      // A hidden recipe is as good as gone for anyone who cannot moderate.
      if (!recipe || (recipe.hidden && !me.canModerate)) {
        setData({ status: 'missing' });
        return;
      }
      const shownTips = tips.filter((t) => me.canModerate || !t.hidden);
      const ids = Array.from(new Set([recipe.authorId, ...shownTips.map((t) => t.authorId)]));
      const people = await store.people(ids);
      if (cancelled) return;
      setData({ status: 'ready', recipe, tips: shownTips, people, me });
    }
    const run = () => {
      load().catch(() => {
        if (!cancelled) setData({ status: 'missing' });
      });
    };
    run();
    const unsubscribe = store.subscribe(run);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [store, id]);

  if (data.status === 'loading') {
    return (
      <Shell tabs={<BackTab />} busy>
        <div className="rc-card rc-card-blank" aria-hidden="true">
          <div className="rc-head rc-head-blank" />
          <div className="rc-ruled rc-ruled-blank" />
        </div>
      </Shell>
    );
  }

  if (data.status === 'missing') {
    return (
      <Shell tabs={<BackTab />}>
        <div className="rc-card">
          <div className="rc-head">
            <h1 className="rc-title">This card isn&apos;t in the tin.</h1>
            <p className="rc-by">
              <a className="rc-link" href={formatHash({ name: 'browse' })} onClick={goBrowse}>
                Back to all recipes
              </a>
            </p>
          </div>
          <div className="rc-ruled rc-ruled-blank" />
        </div>
      </Shell>
    );
  }

  const { recipe, tips, people, me } = data;
  const authorName = people[recipe.authorId]?.name ?? 'a colleague';
  const courseLabel = COURSES[recipe.course]?.label ?? recipe.course;
  const teamCity = [recipe.team, recipe.city].filter(Boolean).join(', ');
  const meta = [
    recipe.origin,
    recipe.occasions.join(', '),
    courseLabel,
    recipe.makes,
    recipe.totalMinutes !== undefined ? formatMinutes(recipe.totalMinutes) : undefined,
  ].filter((x): x is string => Boolean(x));

  const tabs = (
    <>
      <BackTab />
      <span className="rc-tab rc-tab-static">{recipe.origin}</span>
      {recipe.occasions[0] && <span className="rc-tab rc-tab-static">{recipe.occasions[0]}</span>}
      <span className="rc-tab rc-tab-static rc-tab-on">{courseLabel}</span>
    </>
  );

  return (
    <Shell tabs={tabs}>
      <article className="rc-card">
        <header className="rc-head">
          <h1 className="rc-title">{recipe.title}</h1>
          <p className="rc-by">From the kitchen of {authorName}</p>
          {teamCity && <p className="rc-line">{teamCity}</p>}
          <p className="rc-meta">{meta.join(' · ')}</p>
          <ul className="rc-stamps" aria-label="Dietary notes">
            {recipe.sample && <li className="rc-stamp rc-stamp-sample">Sample recipe</li>}
            {recipe.dietary.map((tag) => (
              <li key={tag} className="rc-stamp">
                <span aria-hidden="true">{DIETARY[tag].symbol} </span>
                {DIETARY[tag].label}
              </li>
            ))}
          </ul>
          <div className="rc-actions">
            <button type="button" className="rc-btn rc-btn-prop" onClick={() => navigate({ name: 'kitchen', id: recipe.id })}>
              Prop it up
            </button>
            {me.canModerate && (
              <button
                type="button"
                className="rc-quiet"
                onClick={() => void store.setHidden('recipe', recipe.id, !recipe.hidden)}
              >
                {recipe.hidden ? 'Unhide' : 'Hide'}
              </button>
            )}
          </div>
          {recipe.mainPhoto && <Snapshot photo={recipe.mainPhoto} className="rc-snap-main" />}
        </header>

        <div className="rc-ruled">
          <div className="rc-body">
            <section aria-labelledby="rc-h-story" className="rc-sec">
              <h2 id="rc-h-story" className="rc-sr">
                Story
              </h2>
              <p className="rc-story">{recipe.story}</p>
            </section>

            <section aria-labelledby="rc-h-ing" className="rc-sec">
              <h2 id="rc-h-ing" className="rc-label">
                Ingredients
              </h2>
              <ul className="rc-ing">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i}>
                    <span className="rc-qty">{ing.quantity}</span>
                    <span>{ing.item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="rc-h-steps" className="rc-sec">
              <h2 id="rc-h-steps" className="rc-label">
                Steps
              </h2>
              <ol className="rc-steps">
                {recipe.steps.map((step) => (
                  <li key={step.id}>
                    {step.photo && <Snapshot photo={step.photo} className="rc-snap-step" />}
                    {step.text}
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <section aria-labelledby="rc-h-tips" className="rc-margin">
            <h2 id="rc-h-tips" className="rc-margin-label">
              Tips from the tin
            </h2>
            {tips.length === 0 ? (
              <p className="rc-hand rc-empty">No tips yet. Be the first to write in the margin.</p>
            ) : (
              <ul className="rc-tips">
                {tips.map((tip, i) => (
                  <li key={tip.id} className={`rc-tip rc-pen-${penFor(tip.authorId)} rc-tilt-${i % 3}`}>
                    {tip.hidden && <span className="rc-hidden-note">Hidden from others</span>}
                    <p className="rc-hand">{tip.text}</p>
                    {tip.photo && <Snapshot photo={tip.photo} className="rc-snap-tip" />}
                    <p className="rc-sign">&mdash; {people[tip.authorId]?.name ?? 'A colleague'}</p>
                    {me.canModerate && (
                      <button
                        type="button"
                        className="rc-quiet"
                        onClick={() => void store.setHidden('tip', tip.id, !tip.hidden)}
                      >
                        {tip.hidden ? 'Unhide' : 'Hide'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="rc-btn rc-btn-add" onClick={() => onAddTip?.()}>
              + Add your tip
            </button>
          </section>
        </div>
      </article>
    </Shell>
  );
}
