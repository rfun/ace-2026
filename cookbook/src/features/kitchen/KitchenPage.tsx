import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { formatHash, navigate } from '../../app/router';
import { useStore } from '../../data/StoreProvider';
import { stockClass } from '../../domain/tags';
import type { Recipe } from '../../domain/types';
import './kitchen.css';

type Loaded = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; recipe: Recipe };

const SWIPE_PX = 50;

interface WakeLockSentinelLike {
  release(): Promise<void>;
}
interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

function storageKey(id: string): string {
  return `cookbook.kitchen.${id}`;
}

function readPosition(id: string): number {
  try {
    const n = Number(window.sessionStorage.getItem(storageKey(id)));
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writePosition(id: string, index: number): void {
  try {
    window.sessionStorage.setItem(storageKey(id), String(index));
  } catch {
    // Storage can be blocked; the position just will not survive a reload.
  }
}

function goBrowse(e: MouseEvent): void {
  e.preventDefault();
  navigate({ name: 'browse' });
}

/** Keep the screen awake while mounted, where the browser allows it. Failures are ignored. */
function useWakeLock(): void {
  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
    if (!wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let active = true;
    const acquire = () => {
      wakeLock
        .request('screen')
        .then((s) => {
          if (!active) {
            s.release().catch(() => undefined);
            return;
          }
          sentinel = s;
        })
        .catch(() => undefined);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      sentinel?.release().catch(() => undefined);
      sentinel = null;
    };
  }, []);
}

function Frame(props: { id: string; live?: string; busy?: boolean; children: ReactNode; footer?: ReactNode }): JSX.Element {
  const recipeHref = formatHash({ name: 'recipe', id: props.id });
  return (
    <div className="kt-ground on-enamel" aria-busy={props.busy ? true : undefined}>
      <div className="kt-bar">
        <a
          className="kt-close"
          href={recipeHref}
          onClick={(e) => {
            e.preventDefault();
            navigate({ name: 'recipe', id: props.id });
          }}
        >
          <span aria-hidden="true">&times; </span>Close
        </a>
      </div>
      <p className="sr-only" aria-live="polite" role="status">
        {props.live}
      </p>
      {props.children}
      {props.footer}
    </div>
  );
}

export default function KitchenPage(props: { id: string }): JSX.Element {
  const store = useStore();
  const { id } = props;
  const [data, setData] = useState<Loaded>({ status: 'loading' });
  const [index, setIndex] = useState(() => readPosition(id));
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const startX = useRef<number | null>(null);

  useWakeLock();

  useEffect(() => {
    let cancelled = false;
    setData({ status: 'loading' });
    setIndex(readPosition(id));
    setChecked({});
    const load = () => {
      store
        .getRecipe(id)
        .then((recipe) => {
          if (cancelled) return;
          setData(recipe ? { status: 'ready', recipe } : { status: 'missing' });
        })
        .catch(() => {
          if (!cancelled) setData({ status: 'missing' });
        });
    };
    load();
    const unsubscribe = store.subscribe(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [store, id]);

  const stepCount = data.status === 'ready' ? data.recipe.steps.length : 0;
  const last = stepCount + 1; // card 0 = Gather, 1..N = steps, N+1 = Done
  const current = Math.min(index, last);

  const go = useCallback(
    (delta: number) => {
      if (data.status !== 'ready') return;
      setIndex((i) => {
        const next = Math.max(0, Math.min(Math.min(i, last) + delta, last));
        writePosition(id, next);
        return next;
      });
    },
    [data.status, id, last],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const onPointerDown = (e: PointerEvent) => {
    startX.current = e.clientX;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (dx <= -SWIPE_PX) go(1);
    else if (dx >= SWIPE_PX) go(-1);
  };

  if (data.status === 'loading') {
    return (
      <Frame id={id} busy>
        <div className="kt-card kt-card-blank" aria-hidden="true" />
      </Frame>
    );
  }

  if (data.status === 'missing') {
    return (
      <Frame id={id}>
        <div className="kt-card">
          <h1 className="kt-title">This card isn&apos;t in the tin.</h1>
          <p className="kt-text">
            <a className="kt-link" href={formatHash({ name: 'browse' })} onClick={goBrowse}>
              Back to all recipes
            </a>
          </p>
        </div>
      </Frame>
    );
  }

  const { recipe } = data;
  const onGather = current === 0;
  const onDone = current === last;
  const step = !onGather && !onDone ? recipe.steps[current - 1] : undefined;
  const live = onGather ? 'Showing the ingredients' : onDone ? 'Recipe finished' : `Showing step ${current} of ${stepCount}`;

  let body: JSX.Element;
  if (onGather) {
    body = (
      <>
        <h2 className="kt-title">Gather the ingredients</h2>
        <ul className="kt-ing">
          {recipe.ingredients.map((ing, i) => (
            <li key={i}>
              <label className="kt-check">
                <input
                  type="checkbox"
                  checked={Boolean(checked[i])}
                  onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))}
                />
                <span className="kt-ing-text">
                  <span className="kt-qty">{ing.quantity}</span> {ing.item}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </>
    );
  } else if (onDone) {
    body = (
      <>
        <h2 className="kt-title">All done. Enjoy!</h2>
        <p className="kt-text">{recipe.title}</p>
      </>
    );
  } else {
    body = (
      <>
        <p className="kt-progress">
          Step {current} of {stepCount}
        </p>
        <h2 className="kt-step">{step?.text}</h2>
        {step?.photo && (
          <figure className="snap kt-photo">
            <img src={step.photo.url} alt={step.photo.alt} />
          </figure>
        )}
      </>
    );
  }

  const footer = (
    <div className="kt-nav">
      <button type="button" className="btn kt-btn kt-btn-prev" disabled={onGather} onClick={() => go(-1)}>
        Previous
      </button>
      {onDone ? (
        <button type="button" className="btn kt-btn kt-btn-next" onClick={() => navigate({ name: 'recipe', id })}>
          Back to the recipe
        </button>
      ) : (
        <button type="button" className="btn kt-btn kt-btn-next" onClick={() => go(1)}>
          {current === stepCount ? 'Done' : 'Next'}
        </button>
      )}
    </div>
  );

  return (
    <Frame id={id} live={live} footer={footer}>
      <div
        className={`kt-card kt-slide ${stockClass(recipe.course)}`}
        key={current}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          startX.current = null;
        }}
      >
        <h1 className="sr-only">{recipe.title}</h1>
        {body}
      </div>
    </Frame>
  );
}
