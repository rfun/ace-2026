import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { formatHash, navigate } from '../../app/router';
import { useStore } from '../../data/StoreProvider';
import { COURSES, DIETARY, stockClass } from '../../domain/tags';
import type { Course, DietaryTag, Me, Person, Recipe, RecipeStats, Shelf, UserId } from '../../domain/types';
import { activeCount, applyFilters, distinctSorted, EMPTY_FILTERS, isNew, sortRecipes } from './filters';
import type { BrowseFilters, ShelfFilter, SortMode } from './filters';
import { clearAuthorHandoff, peekAuthorHandoff } from './authorHandoff';
import { clearTagHandoff, peekTagHandoff } from './tagHandoff';
import './browse.css';

type Loaded =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      recipes: Recipe[];
      people: Record<UserId, Person>;
      me: Me;
      /** Empty when stats could not load: no badges, Most made falls back to newest. */
      stats: Record<string, RecipeStats>;
      /** null when the viewer cannot write or the shelf could not load: no shelf UI. */
      shelf: Shelf | null;
      now: number;
    };

const SHELF_LABELS: Record<ShelfFilter, string> = { want: 'Want to make', made: 'Made it', untried: 'Not tried' };
const SORT_LABELS: Record<SortMode, string> = { newest: 'Newest', 'most-made': 'Most made' };

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Chip(props: { label: string; on: boolean; onClick: () => void }): JSX.Element {
  return (
    <button type="button" className="tab bw-chip" aria-pressed={props.on} onClick={props.onClick}>
      {props.label}
    </button>
  );
}

function Group(props: { title: string; children: JSX.Element[] }): JSX.Element | null {
  if (props.children.length === 0) return null;
  return (
    <fieldset className="bw-group">
      <legend className="bw-legend">{props.title}</legend>
      <div className="bw-chips">{props.children}</div>
    </fieldset>
  );
}

function Card(props: { recipe: Recipe; author: string; onAuthor: () => void; stats?: RecipeStats; fresh: boolean; mark?: string }): JSX.Element {
  const { recipe, author, onAuthor, stats, fresh, mark } = props;
  const madeBy = stats?.madeBy ?? 0;
  const go = (e: MouseEvent) => {
    // let modified clicks (new tab) fall through to the real href
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate({ name: 'recipe', id: recipe.id });
  };
  // The title link is stretched over the whole card (see .bw-card-link::after) so the card is one link
  // while the by-line stays a separate button: a button must not sit inside a link.
  return (
    <li className="bw-li">
      <div className={`bw-card ${stockClass(recipe.course)}${recipe.mainPhoto ? ' bw-has-photo' : ''}`}>
        {recipe.mainPhoto && (
          <figure className="snap bw-snap">
            <img src={recipe.mainPhoto.url} alt={recipe.mainPhoto.alt} loading="lazy" />
          </figure>
        )}
        <span className="bw-course" aria-hidden="true">{COURSES[recipe.course]?.label ?? recipe.course}</span>
        <span className="bw-title">
          <a className="bw-card-link" href={formatHash({ name: 'recipe', id: recipe.id })} onClick={go}>{recipe.title}</a>
        </span>
        <button type="button" className="bw-by" title={`See all recipes from ${author}`} onClick={onAuthor}>
          From the kitchen of {author}
        </button>
        <span className="bw-meta">
          {`${recipe.origin} \u00b7 ${COURSES[recipe.course]?.label ?? recipe.course}`}
        </span>
        {recipe.dietary.length > 0 && (
          <span className="bw-stamps">
            {recipe.dietary.map((d) => (
              <span className={`stamp stamp-${DIETARY[d]?.ink}`} key={d}>
                {DIETARY[d]?.label ?? d}
              </span>
            ))}
          </span>
        )}
        {(madeBy >= 1 || fresh || mark) && (
          <span className="bw-badges">
            {mark && <span className="bw-mark">{mark}</span>}
            {fresh && <span className="bw-badge">New</span>}
            {madeBy >= 1 && <span className="bw-badge">{`Made by ${madeBy}`}</span>}
          </span>
        )}
      </div>
    </li>
  );
}

function AddButton(): JSX.Element {
  return (
    <button type="button" className="btn btn-prop" onClick={() => navigate({ name: 'compose' })}>
      Add a recipe
    </button>
  );
}

export default function BrowsePage(): JSX.Element {
  const store = useStore();
  const [data, setData] = useState<Loaded>({ status: 'loading' });
  const [filters, setFilters] = useState<BrowseFilters>(() => {
    const tag = peekTagHandoff();
    return { ...EMPTY_FILTERS, authorId: peekAuthorHandoff(), tags: tag ? [tag] : [] };
  });
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<SortMode>('newest'); // in-session only: no storage
  const seq = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    seq.current += 1;
    const mine = seq.current;
    try {
      const [recipes, me] = await Promise.all([store.listRecipes(), store.me()]);
      // Stats and the shelf are extras: a failure leaves browse working without badges or the shelf group.
      const [statsRes, shelfRes] = await Promise.allSettled([store.stats(), me.canWrite ? store.myShelf() : Promise.reject(new Error('read-only'))]);
      const stats = statsRes.status === 'fulfilled' ? statsRes.value : {};
      const shelf = shelfRes.status === 'fulfilled' ? shelfRes.value : null;
      const ids = Array.from(new Set(recipes.map((r) => r.authorId)));
      const people = await store.people(ids);
      if (mine !== seq.current) return; // a newer load superseded this one
      setData({ status: 'ready', recipes, people, me, stats, shelf, now: Date.now() });
    } catch {
      if (mine !== seq.current) return;
      setData({ status: 'error' });
    }
  }, [store]);

  useEffect(() => {
    clearAuthorHandoff(); // the choice carried from the recipe page has been taken
    clearTagHandoff();
    void load();
    const unsubscribe = store.subscribe(() => void load());
    return () => {
      seq.current += 1; // drop anything still in flight
      unsubscribe();
    };
  }, [store, load]);

  const recipes = useMemo(
    () => (data.status === 'ready' ? sortRecipes(data.recipes, sort, data.stats) : []),
    [data, sort],
  );
  const names = useMemo(() => {
    const m: Record<string, string> = {};
    if (data.status === 'ready') for (const [id, p] of Object.entries(data.people)) m[id] = p.name;
    return m;
  }, [data]);
  const visible = useMemo(
    () =>
      data.status === 'ready'
        ? applyFilters(recipes, filters, names, { meId: data.me.id, shelf: data.shelf ?? undefined, now: data.now })
        : [],
    [data, recipes, filters, names],
  );
  const set = (patch: Partial<BrowseFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const clearAll = () => setFilters(EMPTY_FILTERS);
  const n = activeCount(filters);

  if (data.status === 'loading') {
    return (
      <div className="bw-ground on-tin" aria-busy="true">
        <ul className="bw-grid" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="bw-li"><div className="bw-card bw-card-blank" /></li>
          ))}
        </ul>
      </div>
    );
  }

  if (data.status === 'error') {
    return (
      <div className="bw-ground on-tin">
        <div className="bw-note">
          <p className="bw-note-title">Couldn&apos;t open the tin. Try again.</p>
          <button type="button" className="btn btn-prop" onClick={() => void load()}>Retry</button>
        </div>
      </div>
    );
  }

  const { people, me, stats, shelf, now } = data;
  const nameOf = (id: UserId) => people[id]?.name ?? 'a colleague';

  if (recipes.length === 0) {
    return (
      <div className="bw-ground on-tin">
        <div className="bw-note">
          <p className="bw-note-title">The tin is empty. Add the first recipe.</p>
          {me.canWrite && <AddButton />}
        </div>
      </div>
    );
  }

  const authors = distinctSorted(recipes.map((r) => r.authorId)).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const origins = distinctSorted(recipes.map((r) => r.origin));
  const occasions = distinctSorted(recipes.flatMap((r) => r.occasions));
  const keywords = distinctSorted(recipes.flatMap((r) => r.tags ?? []));

  const active: { key: string; label: string; clear: () => void }[] = [
    ...filters.dietary.map((d) => ({ key: `d-${d}`, label: DIETARY[d].label, clear: () => set({ dietary: toggle(filters.dietary, d) }) })),
    ...filters.courses.map((c) => ({ key: `c-${c}`, label: COURSES[c].label, clear: () => set({ courses: toggle(filters.courses, c) }) })),
    ...filters.origins.map((o) => ({ key: `o-${o}`, label: o, clear: () => set({ origins: toggle(filters.origins, o) }) })),
    ...filters.occasions.map((o) => ({ key: `n-${o}`, label: o, clear: () => set({ occasions: toggle(filters.occasions, o) }) })),
    ...filters.tags.map((t) => ({ key: `k-${t}`, label: t, clear: () => set({ tags: toggle(filters.tags, t) }) })),
    ...(shelf && filters.shelf ? [{ key: 's', label: SHELF_LABELS[filters.shelf], clear: () => set({ shelf: undefined }) }] : []),
    ...(filters.mine ? [{ key: 'm', label: 'My recipes', clear: () => set({ mine: false }) }] : []),
    ...(filters.fresh ? [{ key: 'f', label: 'New this week', clear: () => set({ fresh: false }) }] : []),
    ...(filters.authorId ? [{ key: 'a', label: `From ${nameOf(filters.authorId)}\u2019s kitchen`, clear: () => set({ authorId: undefined }) }] : []),
    ...(filters.text.trim() ? [{ key: 't', label: `“${filters.text.trim()}”`, clear: () => set({ text: '' }) }] : []),
  ];

  return (
    <div className="bw-ground on-tin">
      <div className="bw-top">
        <h1 className="bw-h1">The recipe tin</h1>
        {me.canWrite && <AddButton />}
      </div>

      <div className="bw-search">
        <label className="bw-search-label" htmlFor="bw-search">Search recipes</label>
        <input
          id="bw-search"
          type="search"
          className="bw-input"
          placeholder={'Recipes, people, ingredients\u2026'}
          title="Search recipes, people, ingredients and steps"
          value={filters.text}
          onChange={(e) => set({ text: e.target.value })}
        />
        <button
          type="button"
          className="btn btn-prop bw-toggle"
          aria-expanded={open}
          aria-controls="bw-filters"
          onClick={() => setOpen((o) => !o)}
        >
          Filters ({n})
        </button>
      </div>

      <div className="bw-course-row">
        {shelf && (
          <div className="bw-quick">
            <Chip label="Want to make" on={filters.shelf === 'want'} onClick={() => set({ shelf: filters.shelf === 'want' ? undefined : 'want' })} />
          </div>
        )}
        <Group title="Course">
          {(Object.keys(COURSES) as Course[]).map((c) => (
            <Chip key={c} label={COURSES[c].label} on={filters.courses.includes(c)} onClick={() => set({ courses: toggle(filters.courses, c) })} />
          ))}
        </Group>
        <Group title="Sort">
          {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
            <Chip key={m} label={SORT_LABELS[m]} on={sort === m} onClick={() => setSort(m)} />
          ))}
        </Group>
      </div>

      <div id="bw-filters" className={`bw-filters${open ? ' bw-filters-open' : ''}`}>
        {shelf && (
          <Group title="My shelf">
            {(Object.keys(SHELF_LABELS) as ShelfFilter[]).map((k) => (
              <Chip key={k} label={SHELF_LABELS[k]} on={filters.shelf === k} onClick={() => set({ shelf: filters.shelf === k ? undefined : k })} />
            ))}
          </Group>
        )}
        <Group title="Recipes">
          <Chip label="My recipes" on={filters.mine} onClick={() => set({ mine: !filters.mine })} />
          <Chip label="New this week" on={filters.fresh} onClick={() => set({ fresh: !filters.fresh })} />
        </Group>
        <Group title="Dietary">
          {(Object.keys(DIETARY) as DietaryTag[]).map((d) => (
            <Chip key={d} label={DIETARY[d].label} on={filters.dietary.includes(d)} onClick={() => set({ dietary: toggle(filters.dietary, d) })} />
          ))}
        </Group>
        <Group title="Origin">
          {origins.map((o) => (
            <Chip key={o} label={o} on={filters.origins.includes(o)} onClick={() => set({ origins: toggle(filters.origins, o) })} />
          ))}
        </Group>
        <Group title="Occasion">
          {occasions.map((o) => (
            <Chip key={o} label={o} on={filters.occasions.includes(o)} onClick={() => set({ occasions: toggle(filters.occasions, o) })} />
          ))}
        </Group>
        <Group title="Keywords">
          {keywords.map((t) => (
            <Chip key={t} label={t} on={filters.tags.includes(t)} onClick={() => set({ tags: toggle(filters.tags, t) })} />
          ))}
        </Group>
        <Group title="Contributor">
          {authors.map((a) => (
            <Chip key={a} label={nameOf(a)} on={filters.authorId === a} onClick={() => set({ authorId: filters.authorId === a ? undefined : a })} />
          ))}
        </Group>
      </div>

      {active.length > 0 && (
        <div className="bw-active" role="group" aria-label="Active filters">
          {active.map((a) => (
            <button key={a.key} type="button" className="bw-active-chip" onClick={a.clear} aria-label={`Remove filter ${a.label}`}>
              {a.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="quiet quiet-light" onClick={clearAll}>Clear all filters</button>
        </div>
      )}

      {filters.authorId && <h2 className="bw-h2">Recipes from {nameOf(filters.authorId)}</h2>}

      {visible.length === 0 ? (
        <div className="bw-note">
          <p className="bw-note-title">No cards match these filters.</p>
          <button type="button" className="btn btn-prop" onClick={clearAll}>Clear filters</button>
        </div>
      ) : (
        <ul className="bw-grid">
          {visible.map((r) => (
            <Card
              key={r.id}
              recipe={r}
              author={nameOf(r.authorId)}
              onAuthor={() => set({ authorId: r.authorId })}
              stats={stats[r.id]}
              fresh={isNew(r, now)}
              mark={shelf?.made.includes(r.id) ? 'You made this' : shelf?.want.includes(r.id) ? 'On your list' : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
