import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { formatHash, navigate } from '../../app/router';
import { useStore } from '../../data/StoreProvider';
import { COURSES, DIETARY, stockClass } from '../../domain/tags';
import { applyShelfState } from '../../domain/stats';
import type { MadeNote, Me, Person, Recipe, RecipeStats, Shelf, Tip, UserId } from '../../domain/types';
import { setAuthorHandoff } from '../browse/authorHandoff';
import { setTagHandoff } from '../browse/tagHandoff';
import { MADE_COMPOSER_ID, MadeSection, NO_STATS, ShelfButtons, adjustStats, consumeMadeComposerRequest, shelfStateOf } from '../made';
import { TipComposer } from '../tips';
import { penFor } from './pens';
import { Snapshot } from './Snapshot';
import ServingsControl from './ServingsControl';
import { useServings } from './useServings';
import './recipe.css';

type Loaded =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; recipe: Recipe; tips: Tip[]; made: MadeNote[]; shelf: Shelf; stats: RecipeStats; people: Record<UserId, Person>; me: Me };

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

function BackTab(): JSX.Element {
  return (
    <a className="tab rc-tab rc-tab-back" href={formatHash({ name: 'browse' })} onClick={goBrowse}>
      <span aria-hidden="true" className="rc-arrow">
        {'← '}
      </span>
      All recipes
    </a>
  );
}

function Shell(props: { tabs: JSX.Element; children: JSX.Element; busy?: boolean; stock?: string }): JSX.Element {
  return (
    <div className={`rc-ground ${props.stock ?? ''}`} aria-busy={props.busy ? true : undefined}>
      <nav className="rc-tabs on-tin" aria-label="Recipe location">
        {props.tabs}
      </nav>
      {props.children}
    </div>
  );
}

function Ingredients(props: { recipe: Recipe }): JSX.Element {
  const { recipe } = props;
  const sv = useServings(recipe.id, recipe.serves, recipe.ingredients);
  return (
    <section aria-labelledby="rc-h-ing" className="rc-sec">
      <h2 id="rc-h-ing" className="label">
        Ingredients
      </h2>
      {sv.servings !== undefined && (
        <ServingsControl servings={sv.servings} changed={sv.changed} onChange={sv.set} onReset={sv.reset} />
      )}
      <ul className={`rc-ing${sv.hasUnscaled ? ' rc-ing-noted' : ''}`}>
        {sv.scaled.map((ing, i) => (
          <li key={i}>
            <span className="rc-qty">{ing.quantity}</span>
            <span>{ing.item}</span>
          </li>
        ))}
      </ul>
      {sv.hasUnscaled && <p className="rc-note">Amounts without a number aren&apos;t scaled</p>}
    </section>
  );
}

export default function RecipePage(props: { id: string; onAddTip?: () => void }): JSX.Element {
  const store = useStore();
  const { id, onAddTip } = props;
  const [data, setData] = useState<Loaded>({ status: 'loading' });
  const [composing, setComposing] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const refocusAdd = useRef(false);
  // Each load takes a number; only the newest one may write state.
  const seq = useRef(0);
  const reload = useRef<() => void>(() => undefined);

  useEffect(() => {
    let cancelled = false;
    setData({ status: 'loading' });
    setComposing(false);
    setJustAdded(null);
    async function load(): Promise<Loaded> {
      // Notes, shelf and counts are extras: if one fails the card still opens without it.
      const [recipe, tips, me, made, shelf, allStats] = await Promise.all([
        store.getRecipe(id),
        store.listTips(id),
        store.me(),
        store.listMade(id).catch((): MadeNote[] => []),
        store.myShelf().catch((): Shelf => ({ want: [], made: [] })),
        store.stats().catch((): Record<string, RecipeStats> => ({})),
      ]);
      // A hidden recipe is as good as gone for anyone who cannot moderate.
      if (!recipe || (recipe.hidden && !me.canModerate)) return { status: 'missing' };
      const shownTips = tips.filter((t) => me.canModerate || !t.hidden);
      const shownMade = made.filter((n) => me.canModerate || !n.hidden);
      const ids = Array.from(new Set([recipe.authorId, ...shownTips.map((t) => t.authorId), ...shownMade.map((n) => n.authorId)]));
      const people = await store.people(ids);
      return { status: 'ready', recipe, tips: shownTips, made: shownMade, shelf, stats: allStats[id] ?? NO_STATS, people, me };
    }
    const run = () => {
      const mine = ++seq.current;
      load().then(
        (next) => {
          if (!cancelled && mine === seq.current) setData(next);
        },
        () => {
          // A failed background refresh keeps the card already on screen.
          if (!cancelled && mine === seq.current) setData((prev) => (prev.status === 'ready' ? prev : { status: 'error' }));
        },
      );
    };
    reload.current = run;
    run();
    const unsubscribe = store.subscribe(run);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [store, id]);

  const retry = useCallback(() => {
    setData({ status: 'loading' });
    reload.current();
  }, []);

  // Kitchen mode's "Made it? Tell us how it went" lands here: scroll to the composer and focus it.
  useEffect(() => {
    if (data.status !== 'ready' || !consumeMadeComposerRequest()) return;
    const form = document.getElementById(MADE_COMPOSER_ID);
    if (!form) return;
    if (typeof form.scrollIntoView === 'function') form.scrollIntoView({ block: 'center' });
    form.querySelector('textarea')?.focus();
  }, [data.status]);

  useEffect(() => {
    if (!composing && refocusAdd.current) {
      refocusAdd.current = false;
      addBtnRef.current?.focus();
    }
  }, [composing, data.status]);

  function closeComposer(): void {
    refocusAdd.current = true;
    setComposing(false);
  }

  function onMadePosted(note: MadeNote): void {
    // Posting also puts the recipe on the Made it shelf; show that now, ahead of the store's refresh.
    setData((prev) => {
      if (prev.status !== 'ready' || prev.made.some((n) => n.id === note.id)) return prev;
      const was = shelfStateOf(prev.shelf, prev.recipe.id);
      return {
        ...prev,
        made: [...prev.made, note],
        shelf: applyShelfState(prev.shelf, prev.recipe.id, 'made'),
        stats: adjustStats(prev.stats, was, 'made'),
      };
    });
  }

  function onTipDone(tip: Tip): void {
    setJustAdded(tip.id);
    setData((prev) => {
      if (prev.status !== 'ready' || prev.tips.some((t) => t.id === tip.id)) return prev;
      return { ...prev, tips: [...prev.tips, tip] };
    });
    closeComposer();
  }

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

  if (data.status === 'error') {
    return (
      <Shell tabs={<BackTab />}>
        <div className="rc-card">
          <div className="rc-head">
            <h1 className="rc-title">Couldn&apos;t open this card. Try again.</h1>
            <p className="rc-by">
              <button type="button" className="btn btn-prop" onClick={retry}>
                Try again
              </button>
            </p>
          </div>
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

  const { recipe, tips, made, shelf, stats, people, me } = data;
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

  const canEdit = me.canWrite && me.id === recipe.authorId;

  const tabs = (
    <>
      <BackTab />
      <span className="rc-where">{recipe.origin}</span>
      {recipe.occasions[0] && <span className="rc-where">{recipe.occasions[0]}</span>}
      <span className="rc-where">{courseLabel}</span>
    </>
  );

  return (
    <Shell tabs={tabs} stock={stockClass(recipe.course)}>
      <article className="rc-card">
        <header className="rc-head">
          <h1 className="rc-title">{recipe.title}</h1>
          <p className="rc-by">
            <button
              type="button"
              className="rc-by-btn"
              title={`See all recipes from ${authorName}`}
              onClick={() => {
                setAuthorHandoff(recipe.authorId);
                navigate({ name: 'browse' });
              }}
            >
              From the kitchen of {authorName}
            </button>
          </p>
          {teamCity && <p className="rc-line">{teamCity}</p>}
          <p className="rc-meta">{meta.join(' · ')}</p>
          <ShelfButtons recipeId={recipe.id} state={shelfStateOf(shelf, recipe.id)} stats={stats} canWrite={me.canWrite} />
          {recipe.tags && recipe.tags.length > 0 && (
            <ul className="rc-tags" aria-label="Keywords">
              {recipe.tags.map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    className="rc-tag"
                    title={`See all recipes tagged ${tag}`}
                    onClick={() => {
                      setTagHandoff(tag);
                      navigate({ name: 'browse' });
                    }}
                  >
                    {tag}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ul className="rc-stamps" aria-label="Dietary notes">
            {recipe.sample && <li className="stamp stamp-sample">Sample recipe</li>}
            {recipe.dietary.map((tag) => (
              <li key={tag} className={`stamp stamp-${DIETARY[tag].ink}`}>
                {DIETARY[tag].label}
              </li>
            ))}
          </ul>
          <div className="rc-actions">
            <button type="button" className="btn btn-prop" onClick={() => navigate({ name: 'kitchen', id: recipe.id })}>
              Prop it up
            </button>
            {canEdit && (
              <button type="button" className="quiet" onClick={() => navigate({ name: 'compose', id: recipe.id })}>
                Edit this card
              </button>
            )}
            {me.canModerate && (
              <button
                type="button"
                className="quiet"
                onClick={() => void store.setHidden('recipe', recipe.id, !recipe.hidden)}
              >
                {recipe.hidden ? 'Unhide' : 'Hide'}
              </button>
            )}
          </div>
          {recipe.mainPhoto && <Snapshot photo={recipe.mainPhoto} className="rc-snap-main" />}
        </header>

        <div className={`rc-ruled${composing ? ' rc-composing' : ''}`}>
          <div className="rc-body">
            <section aria-labelledby="rc-h-story" className="rc-sec">
              <h2 id="rc-h-story" className="sr-only">
                Story
              </h2>
              <p className="rc-story">{recipe.story}</p>
            </section>

            <Ingredients recipe={recipe} />

            <section aria-labelledby="rc-h-steps" className="rc-sec">
              <h2 id="rc-h-steps" className="label">
                Steps
              </h2>
              <ol className="rc-steps">
                {recipe.steps.map((step) => (
                  <li key={step.id}>
                    <span className="rc-step-text">{step.text}</span>
                    {step.photo && <Snapshot photo={step.photo} className="rc-snap-step" />}
                  </li>
                ))}
              </ol>
            </section>

            <MadeSection recipeId={recipe.id} notes={made} people={people} me={me} onPosted={onMadePosted} />
          </div>

          <section aria-labelledby="rc-h-tips" className="rc-margin">
            <h2 id="rc-h-tips" className="label label-ink rc-margin-label">
              Tips from the tin
            </h2>
            {tips.length === 0 ? (
              <p className="rc-hand rc-empty">No tips yet. Be the first to write in the margin.</p>
            ) : (
              <ul className="rc-tips">
                {tips.map((tip, i) => (
                  <li key={tip.id} className={`rc-tip pen-${penFor(tip.authorId)} rc-tilt-${i % 3}${tip.id === justAdded ? ' rc-tip-new' : ''}`}>
                    {tip.hidden && <span className="rc-hidden-note">Hidden from others</span>}
                    <p className="rc-hand">{tip.text}</p>
                    {tip.photo && <Snapshot photo={tip.photo} className="rc-snap-tip" />}
                    <p className="rc-sign">&mdash; {people[tip.authorId]?.name ?? 'A colleague'}</p>
                    {me.canModerate && (
                      <button
                        type="button"
                        className="quiet"
                        onClick={() => void store.setHidden('tip', tip.id, !tip.hidden)}
                      >
                        {tip.hidden ? 'Unhide' : 'Hide'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {composing ? (
              <TipComposer recipeId={recipe.id} onDone={onTipDone} onCancel={closeComposer} />
            ) : (
              <button
                type="button"
                ref={addBtnRef}
                className="btn"
                onClick={() => (onAddTip ? onAddTip() : setComposing(true))}
              >
                + Add your tip
              </button>
            )}
          </section>
        </div>
      </article>
    </Shell>
  );
}
