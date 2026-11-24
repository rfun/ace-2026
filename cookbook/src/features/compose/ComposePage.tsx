import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, MouseEvent } from 'react';
import { formatHash, navigate } from '../../app/router';
import { useStore } from '../../data/StoreProvider';
import { COURSES, DIETARY } from '../../domain/tags';
import type { Course, DietaryTag, Me, Recipe } from '../../domain/types';
import { ImageTooLargeError, resizeImage } from '../../lib/image/resize';
import {
  blankForm,
  clearStoredDraft,
  emptySlot,
  formFromRecipe,
  isUploading,
  loadStoredDraft,
  newKey,
  storeDraft,
  toDraft,
  validate,
} from './form';
import type { Errors, FormState, PhotoSlot } from './form';
import './compose.css';

type Loaded =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; me: Me; recipe?: Recipe };

type SlotTarget = { kind: 'main' } | { kind: 'step'; key: string };

function goTo(route: Parameters<typeof navigate>[0]) {
  return (e: MouseEvent) => {
    e.preventDefault();
    navigate(route);
  };
}

function Shell(props: { tab: string; children: React.ReactNode; busy?: boolean }): JSX.Element {
  return (
    <div className="cp-ground" aria-busy={props.busy ? true : undefined}>
      <nav className="cp-tabs" aria-label="Recipe location">
        <a className="cp-tab" href={formatHash({ name: 'browse' })} onClick={goTo({ name: 'browse' })}>
          All recipes
        </a>
        <span className="cp-tab cp-tab-on">{props.tab}</span>
      </nav>
      {props.children}
    </div>
  );
}

function Notice(props: { tab: string; message: string; backTo: Parameters<typeof navigate>[0]; backLabel: string }): JSX.Element {
  return (
    <Shell tab={props.tab}>
      <div className="cp-card cp-notice">
        <h1 className="cp-title">{props.tab}</h1>
        <p className="cp-line" role="status">{props.message}</p>
        <a className="cp-link" href={formatHash(props.backTo)} onClick={goTo(props.backTo)}>
          {props.backLabel}
        </a>
      </div>
    </Shell>
  );
}

function FieldError(props: { id: string; errors: Errors }): JSX.Element | null {
  const msg = props.errors[props.id];
  return msg ? <p className="cp-err" id={`${props.id}-err`}>{msg}</p> : null;
}

function errProps(id: string, errors: Errors) {
  return errors[id] ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-err` } : {};
}

function PhotoField(props: {
  id: string;
  label: string;
  slot: PhotoSlot;
  errors: Errors;
  capture?: boolean;
  onFile: (file: File) => void;
  onAlt: (alt: string) => void;
  onRemove: () => void;
}): JSX.Element {
  const { slot } = props;
  const altId = `f-alt-${props.id}`;
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) props.onFile(file);
  };
  return (
    <div className="cp-photo">
      <input
        id={`f-file-${props.id}`}
        className="cp-sr"
        type="file"
        accept="image/*"
        capture={props.capture ? 'environment' : undefined}
        onChange={onChange}
        disabled={slot.status === 'uploading' || !!slot.photo}
      />
      {!slot.photo && (
        <label className="cp-btn cp-btn-prop cp-filebtn" htmlFor={`f-file-${props.id}`}>
          {slot.status === 'uploading' ? 'Uploading…' : props.label}
        </label>
      )}
      {slot.status === 'uploading' && <p className="cp-note" role="status">Uploading photo…</p>}
      {slot.status === 'error' && <p className="cp-err" role="alert">{slot.error}</p>}
      {slot.photo && (
        <div className="cp-snaprow">
          <figure className="cp-snap">
            <img src={slot.photo.url} alt={slot.alt || 'Photo preview'} />
          </figure>
          <div className="cp-snapfields">
            <label className="cp-label" htmlFor={altId}>Photo description (alt text) <span aria-hidden="true">*</span></label>
            <input
              id={altId}
              className="cp-input"
              type="text"
              value={slot.alt}
              onChange={(e) => props.onAlt(e.target.value)}
              aria-required="true"
              {...errProps(altId, props.errors)}
            />
            <FieldError id={altId} errors={props.errors} />
            <button type="button" className="cp-quiet" onClick={props.onRemove}>Remove photo</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Rowtools(props: { what: string; index: number; count: number; onMove: (d: -1 | 1) => void; onRemove: () => void }): JSX.Element {
  const n = props.index + 1;
  return (
    <div className="cp-tools">
      <button type="button" className="cp-icon" onClick={() => props.onMove(-1)} disabled={props.index === 0} aria-label={`Move ${props.what} ${n} up`}>
        <span aria-hidden="true">↑</span>
      </button>
      <button type="button" className="cp-icon" onClick={() => props.onMove(1)} disabled={props.index === props.count - 1} aria-label={`Move ${props.what} ${n} down`}>
        <span aria-hidden="true">↓</span>
      </button>
      <button type="button" className="cp-icon" onClick={props.onRemove} disabled={props.count === 1} aria-label={`Remove ${props.what} ${n}`}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

function moved<T>(list: T[], from: number, dir: -1 | 1): T[] {
  const to = from + dir;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function TextField(props: {
  id: string; label: string; value: string; required?: boolean; hint?: string; multiline?: boolean; errors: Errors;
  inputMode?: 'numeric'; onChange: (v: string) => void; className?: string;
}): JSX.Element {
  const common = {
    id: props.id,
    value: props.value,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => props.onChange(e.target.value),
    'aria-required': props.required ? ('true' as const) : undefined,
    ...errProps(props.id, props.errors),
  };
  return (
    <div className={`cp-field ${props.className ?? ''}`}>
      <label className="cp-label" htmlFor={props.id}>
        {props.label}
        {props.required && <span aria-hidden="true"> *</span>}
      </label>
      {props.hint && <p className="cp-hint">{props.hint}</p>}
      {props.multiline ? (
        <textarea className="cp-input cp-area" rows={4} {...common} />
      ) : (
        <input className="cp-input" type="text" inputMode={props.inputMode} {...common} />
      )}
      <FieldError id={props.id} errors={props.errors} />
    </div>
  );
}

export default function ComposePage(props: { id?: string }): JSX.Element {
  const store = useStore();
  const { id } = props;
  const isNew = id === undefined;
  const [data, setData] = useState<Loaded>({ status: 'loading' });
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [restored, setRestored] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const skipPersist = useRef(false);

  useEffect(() => {
    let live = true;
    setData({ status: 'loading' });
    setForm(null);
    setErrors({});
    skipPersist.current = false;
    (async () => {
      try {
        const me = await store.me();
        if (!live) return;
        if (isNew) {
          const stored = loadStoredDraft();
          setRestored(stored !== null);
          setForm(stored ?? blankForm());
          setData({ status: 'ready', me });
          return;
        }
        const recipe = await store.getRecipe(id);
        if (!live) return;
        if (!recipe) {
          setData({ status: 'missing' });
          return;
        }
        setForm(formFromRecipe(recipe));
        setData({ status: 'ready', me, recipe });
      } catch {
        if (live) setData({ status: 'missing' });
      }
    })();
    return () => {
      live = false;
    };
  }, [store, id, isNew]);

  useEffect(() => {
    if (isNew && form && !skipPersist.current) storeDraft(form);
  }, [isNew, form]);

  useEffect(() => {
    if (attempt > 0 && Object.keys(errors).length > 0) summaryRef.current?.focus();
  }, [attempt, errors]);

  if (data.status === 'loading' || (data.status === 'ready' && !form)) {
    return (
      <Shell tab={isNew ? 'New recipe card' : 'Edit recipe card'} busy>
        <div className="cp-card cp-notice"><p className="cp-line" role="status">Fetching the card…</p></div>
      </Shell>
    );
  }
  if (data.status === 'missing') {
    return <Notice tab="Edit recipe card" message="This card isn't in the tin." backTo={{ name: 'browse' }} backLabel="Back to all recipes" />;
  }
  const { me, recipe } = data;
  const tab = isNew ? 'New recipe card' : 'Edit recipe card';
  if (!me.canWrite) {
    return (
      <Notice
        tab={tab}
        message="You can read the cookbook, but adding recipes needs Contributor access."
        backTo={{ name: 'browse' }}
        backLabel="Back to all recipes"
      />
    );
  }
  if (recipe && recipe.authorId !== me.id && !me.canModerate) {
    return (
      <Notice
        tab={tab}
        message="Only the person who added this recipe can edit it."
        backTo={{ name: 'recipe', id: recipe.id }}
        backLabel="Back to the recipe"
      />
    );
  }
  if (!form) return <></>;

  const patch = (p: Partial<FormState>) => setForm((f) => (f ? { ...f, ...p } : f));
  const cancelRoute = recipe ? ({ name: 'recipe', id: recipe.id } as const) : ({ name: 'browse' } as const);

  const updateSlot = (t: SlotTarget, fn: (s: PhotoSlot) => PhotoSlot) =>
    setForm((f) => {
      if (!f) return f;
      if (t.kind === 'main') return { ...f, main: fn(f.main) };
      return { ...f, steps: f.steps.map((s) => (s.key === t.key ? { ...s, slot: fn(s.slot) } : s)) };
    });

  const upload = async (t: SlotTarget, file: File, defaultAlt: string) => {
    updateSlot(t, (s) => ({ ...s, status: 'uploading', error: undefined }));
    try {
      const small = await resizeImage(file);
      const photo = await store.uploadPhoto(small, defaultAlt);
      updateSlot(t, (s) => ({ photo, alt: s.alt || defaultAlt, status: 'idle' }));
    } catch (err) {
      const message =
        err instanceof ImageTooLargeError
          ? 'That photo is larger than 20 MB. Choose a smaller one.'
          : 'The photo did not upload. Try again.';
      updateSlot(t, (s) => ({ ...s, status: 'error', error: message }));
    }
  };

  const discardDraft = () => {
    clearStoredDraft();
    setRestored(false);
    setErrors({});
    setForm(blankForm());
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || isUploading(form)) return;
    const found = validate(form);
    setErrors(found);
    setSaveFailed(false);
    setAttempt((n) => n + 1);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const draft = toDraft(form, recipe);
      const saved = await store.saveRecipe(recipe ? { ...draft, id: recipe.id } : draft);
      skipPersist.current = true;
      clearStoredDraft();
      navigate({ name: 'recipe', id: saved.id });
    } catch {
      setSaveFailed(true);
      setSaving(false);
    }
  };

  const focusField = (fieldId: string) => (e: MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(fieldId);
    el?.scrollIntoView?.({ block: 'center' });
    el?.focus();
  };

  const errorIds = Object.keys(errors);
  const uploading = isUploading(form);
  const altFor = (text: string) => text.trim().slice(0, 80) || form.title.trim();

  return (
    <Shell tab={tab}>
      <form className="cp-card" onSubmit={onSubmit} noValidate aria-labelledby="cp-heading">
        <header className="cp-head">
          <h1 className="cp-title" id="cp-heading">{isNew ? 'New recipe card' : 'Edit recipe card'}</h1>
          <p className="cp-line">Fields marked <span aria-hidden="true">*</span><span className="cp-sr">with an asterisk</span> are required.</p>
          {isNew && restored && (
            <p className="cp-note" role="status">
              We kept your unsaved draft from last time.
            </p>
          )}
        </header>

        {errorIds.length > 0 && (
          <div className="cp-summary" ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="cp-summary-h">
            <h2 className="cp-summary-h" id="cp-summary-h">
              {errorIds.length === 1 ? 'One thing needs fixing' : `${errorIds.length} things need fixing`}
            </h2>
            <ul>
              {errorIds.map((fid) => (
                <li key={fid}>
                  <a href={window.location.hash || '#/compose'} onClick={focusField(fid)}>{errors[fid]}</a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="cp-body">
          <TextField id="f-title" label="Title" required value={form.title} errors={errors} onChange={(v) => patch({ title: v })} />
          <TextField
            id="f-story" label="The story behind it" required multiline value={form.story} errors={errors}
            hint="Who made it for you, and when does it appear?" onChange={(v) => patch({ story: v })}
          />

          <div className="cp-cols">
            <TextField
              id="f-origin" label="Culture or region" required value={form.origin} errors={errors}
              hint="For example: Punjab, Oaxaca, Lagos" onChange={(v) => patch({ origin: v })}
            />
            <TextField
              id="f-occasions" label="Occasions" value={form.occasions} errors={errors}
              hint="Separate with commas: Diwali, birthdays" onChange={(v) => patch({ occasions: v })}
            />
            <div className="cp-field">
              <label className="cp-label" htmlFor="f-course">Course <span aria-hidden="true">*</span></label>
              <select
                id="f-course" className="cp-input" value={form.course} aria-required="true"
                onChange={(e) => patch({ course: e.target.value as Course | '' })} {...errProps('f-course', errors)}
              >
                <option value="">Choose a course</option>
                {(Object.keys(COURSES) as Course[]).map((c) => (
                  <option key={c} value={c}>{COURSES[c].label}</option>
                ))}
              </select>
              <FieldError id="f-course" errors={errors} />
            </div>
            <TextField id="f-minutes" label="Total time (minutes)" inputMode="numeric" value={form.minutes} errors={errors} onChange={(v) => patch({ minutes: v })} />
            <TextField id="f-makes" label="Makes" value={form.makes} errors={errors} hint="For example: 24 ladoos" onChange={(v) => patch({ makes: v })} />
            <TextField id="f-team" label="Team" value={form.team} errors={errors} onChange={(v) => patch({ team: v })} />
            <TextField id="f-city" label="City" value={form.city} errors={errors} onChange={(v) => patch({ city: v })} />
          </div>

          <fieldset className="cp-set">
            <legend className="cp-label">Dietary notes</legend>
            <div className="cp-checks">
              {(Object.keys(DIETARY) as DietaryTag[]).map((d) => (
                <label key={d} className="cp-check">
                  <input
                    type="checkbox"
                    checked={form.dietary.includes(d)}
                    onChange={(e) =>
                      patch({ dietary: e.target.checked ? [...form.dietary, d] : form.dietary.filter((x) => x !== d) })
                    }
                  />
                  <span aria-hidden="true" className="cp-sym">{DIETARY[d].symbol}</span>
                  {DIETARY[d].label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="cp-set">
            <legend className="cp-label">Main photo</legend>
            <PhotoField
              id="main" label="Add a main photo" slot={form.main} errors={errors}
              onFile={(file) => void upload({ kind: 'main' }, file, form.title.trim())}
              onAlt={(alt) => patch({ main: { ...form.main, alt } })}
              onRemove={() => patch({ main: emptySlot() })}
            />
          </fieldset>

          <fieldset className="cp-set">
            <legend className="cp-label">Ingredients <span aria-hidden="true">*</span></legend>
            <ul className="cp-rows">
              {form.ingredients.map((ing, idx) => {
                const eid = `f-ing-${idx}`;
                const set = (p: Partial<typeof ing>) =>
                  patch({ ingredients: form.ingredients.map((x) => (x.key === ing.key ? { ...x, ...p } : x)) });
                return (
                  <li key={ing.key} className="cp-row cp-ing">
                    <div className="cp-qty">
                      <label className="cp-label cp-small" htmlFor={`f-qty-${idx}`}>Ingredient {idx + 1} amount</label>
                      <input id={`f-qty-${idx}`} className="cp-input cp-hand" type="text" value={ing.quantity} onChange={(e) => set({ quantity: e.target.value })} />
                    </div>
                    <div className="cp-item">
                      <label className="cp-label cp-small" htmlFor={eid}>Ingredient {idx + 1} name</label>
                      <input id={eid} className="cp-input" type="text" value={ing.item} onChange={(e) => set({ item: e.target.value })} {...errProps(eid, errors)} />
                      <FieldError id={eid} errors={errors} />
                    </div>
                    <Rowtools
                      what="ingredient" index={idx} count={form.ingredients.length}
                      onMove={(d) => patch({ ingredients: moved(form.ingredients, idx, d) })}
                      onRemove={() => patch({ ingredients: form.ingredients.filter((x) => x.key !== ing.key) })}
                    />
                  </li>
                );
              })}
            </ul>
            <button type="button" className="cp-btn cp-btn-prop" onClick={() => patch({ ingredients: [...form.ingredients, { key: newKey('i'), quantity: '', item: '' }] })}>
              Add an ingredient
            </button>
          </fieldset>

          <fieldset className="cp-set">
            <legend className="cp-label">Steps <span aria-hidden="true">*</span></legend>
            <ol className="cp-rows cp-steps">
              {form.steps.map((step, idx) => {
                const sid = `f-step-${idx}`;
                const set = (p: Partial<typeof step>) =>
                  patch({ steps: form.steps.map((x) => (x.key === step.key ? { ...x, ...p } : x)) });
                return (
                  <li key={step.key} className="cp-row cp-step">
                    <div className="cp-stepmain">
                      <label className="cp-label cp-small" htmlFor={sid}>Step {idx + 1}</label>
                      <textarea id={sid} className="cp-input cp-area" rows={3} value={step.text} onChange={(e) => set({ text: e.target.value })} {...errProps(sid, errors)} />
                      <FieldError id={sid} errors={errors} />
                      <PhotoField
                        id={`s-${idx}`} label={`Add a photo for step ${idx + 1}`} capture slot={step.slot} errors={errors}
                        onFile={(file) => void upload({ kind: 'step', key: step.key }, file, altFor(step.text))}
                        onAlt={(alt) => set({ slot: { ...step.slot, alt } })}
                        onRemove={() => set({ slot: emptySlot() })}
                      />
                    </div>
                    <Rowtools
                      what="step" index={idx} count={form.steps.length}
                      onMove={(d) => patch({ steps: moved(form.steps, idx, d) })}
                      onRemove={() => patch({ steps: form.steps.filter((x) => x.key !== step.key) })}
                    />
                  </li>
                );
              })}
            </ol>
            <button type="button" className="cp-btn cp-btn-prop" onClick={() => patch({ steps: [...form.steps, { key: newKey('s'), text: '', slot: emptySlot() }] })}>
              Add a step
            </button>
          </fieldset>
        </div>

        <footer className="cp-foot">
          {saveFailed && <p className="cp-err" role="alert">Couldn&apos;t save. Your text is still here.</p>}
          {uploading && <p className="cp-note" role="status">Waiting for photos to finish uploading…</p>}
          <div className="cp-actions">
            <button type="submit" className="cp-btn" disabled={saving || uploading}>
              {saving ? 'Saving…' : 'Save recipe'}
            </button>
            <a className="cp-quiet" href={formatHash(cancelRoute)} onClick={goTo(cancelRoute)}>Cancel</a>
            {isNew && <button type="button" className="cp-quiet" onClick={discardDraft}>Discard draft</button>}
          </div>
        </footer>
      </form>
    </Shell>
  );
}
