import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, MouseEvent } from 'react';
import { formatHash, navigate } from '../../app/router';
import { useStore } from '../../data/StoreProvider';
import { COURSES, DIETARY } from '../../domain/tags';
import type { Course, DietaryTag, Me, Recipe } from '../../domain/types';
import type { ImportedBy, ImportedRecipe } from '../../lib/import';
import { PHOTO_ACCEPT, PHOTO_HINT, PHOTO_PREPARING, photoErrorMessage } from '../../lib/image/messages';
import { preparePhoto } from '../../lib/image/prepare';
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
import ImportPanel, { BY_LINE } from './ImportPanel';
import TagsField from './TagsField';
import { appendIngredients, appendSteps, describeFilled, mergeImported } from './importMerge';
import type { PendingLists } from './importMerge';
import './compose.css';

type Loaded =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'failed' }
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
      <nav className="cp-tabs on-tin" aria-label="Recipe location">
        <a className="tab cp-tab" href={formatHash({ name: 'browse' })} onClick={goTo({ name: 'browse' })}>
          All recipes
        </a>
        <span className="tab cp-tab is-active">{props.tab}</span>
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

function errProps(id: string, errors: Errors, hintId?: string) {
  const ids = [hintId, errors[id] ? `${id}-err` : undefined].filter(Boolean).join(' ');
  return {
    ...(errors[id] ? { 'aria-invalid': true as const } : {}),
    ...(ids ? { 'aria-describedby': ids } : {}),
  };
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
  const fileId = `f-file-${props.id}`;
  const hintId = `${fileId}-hint`;
  const errId = `${fileId}-err`;
  const working = slot.status === 'uploading' || slot.status === 'preparing';
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) props.onFile(file);
  };
  return (
    <div className="cp-photo">
      <input
        id={fileId}
        className="sr-only"
        type="file"
        accept={PHOTO_ACCEPT}
        capture={props.capture ? 'environment' : undefined}
        onChange={onChange}
        disabled={working || !!slot.photo}
        aria-describedby={slot.status === 'error' ? `${hintId} ${errId}` : hintId}
        aria-invalid={slot.status === 'error' ? true : undefined}
      />
      {!slot.photo && (
        <label className="btn btn-prop cp-filebtn" htmlFor={fileId}>
          {slot.status === 'preparing' ? 'Preparing…' : slot.status === 'uploading' ? 'Uploading…' : props.label}
        </label>
      )}
      {!slot.photo && <p className="cp-hint" id={hintId}>{PHOTO_HINT}</p>}
      {slot.status === 'preparing' && <p className="cp-note" role="status">{PHOTO_PREPARING}</p>}
      {slot.status === 'uploading' && <p className="cp-note" role="status">Uploading photo…</p>}
      {slot.status === 'error' && <p className="cp-err" id={errId} role="alert">{slot.error}</p>}
      {slot.photo && (
        <div className="cp-snaprow">
          <figure className="snap cp-snap">
            <img src={slot.photo.url} alt={slot.alt || 'Photo preview'} />
          </figure>
          <div className="cp-snapfields">
            <label className="label" htmlFor={altId}>Photo description (alt text) <span aria-hidden="true">*</span></label>
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
            <button type="button" className="quiet" onClick={props.onRemove}>Remove photo</button>
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
      {props.index > 0 && (
        <button type="button" className="quiet cp-tool" onClick={() => props.onMove(-1)} aria-label={`Move ${props.what} ${n} up`}>
          Up
        </button>
      )}
      {props.index < props.count - 1 && (
        <button type="button" className="quiet cp-tool" onClick={() => props.onMove(1)} aria-label={`Move ${props.what} ${n} down`}>
          Down
        </button>
      )}
      {props.count > 1 && (
        <button type="button" className="quiet cp-tool" onClick={props.onRemove} aria-label={`Remove ${props.what} ${n}`}>
          Remove
        </button>
      )}
    </div>
  );
}

const blankText = (s: string) => s.trim().length === 0;

function moved<T>(list: T[], from: number, dir: -1 | 1): T[] {
  const to = from + dir;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function TextField(props: {
  id: string; label: string; value: string; required?: boolean; hint?: string; multiline?: boolean; errors: Errors;
  inputMode?: 'numeric'; type?: 'number'; min?: number; max?: number; onChange: (v: string) => void; className?: string; placeholder?: string;
}): JSX.Element {
  const common = {
    id: props.id,
    value: props.value,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => props.onChange(e.target.value),
    'aria-required': props.required ? ('true' as const) : undefined,
    placeholder: props.placeholder,
    ...errProps(props.id, props.errors, props.hint ? `${props.id}-hint` : undefined),
  };
  return (
    <div className={`cp-field ${props.className ?? ''}`}>
      <label className="label" htmlFor={props.id}>
        {props.label}
        {props.required && <span aria-hidden="true"> *</span>}
      </label>
      {props.multiline ? (
        <textarea className="cp-input cp-area" rows={4} {...common} />
      ) : (
        <input className="cp-input" type={props.type ?? 'text'} inputMode={props.inputMode} min={props.min} max={props.max} {...common} />
      )}
      {props.hint && <p className="cp-hint" id={`${props.id}-hint`}>{props.hint}</p>}
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
  const [importOpen, setImportOpen] = useState(false);
  const [importNote, setImportNote] = useState<{ summary: string; by?: ImportedBy } | null>(null);
  const [pending, setPending] = useState<PendingLists>({});
  const [focusTick, setFocusTick] = useState(0);

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
        if (live) setData({ status: 'failed' });
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

  useEffect(() => {
    if (focusTick > 0) document.getElementById('f-title')?.focus();
  }, [focusTick]);

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
  if (data.status === 'failed') {
    return <Notice tab="Recipe card" message="Couldn't load this card. Check your connection and try again." backTo={{ name: 'browse' }} backLabel="Back to all recipes" />;
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
  if (recipe && recipe.authorId !== me.id) {
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
    updateSlot(t, (s) => ({ ...s, status: 'preparing', error: undefined }));
    try {
      const small = await preparePhoto(file);
      updateSlot(t, (s) => ({ ...s, status: 'uploading' }));
      const photo = await store.uploadPhoto(small, defaultAlt);
      updateSlot(t, (s) => ({ photo, alt: s.alt || defaultAlt, status: 'idle' }));
    } catch (err) {
      updateSlot(t, (s) => ({ ...s, status: 'error', error: photoErrorMessage(err) }));
    }
  };

  const discardDraft = () => {
    clearStoredDraft();
    setRestored(false);
    setErrors({});
    setForm(blankForm());
    setPending({});
    setImportNote(null);
  };

  // Pre-fill only: nothing is saved, and the member's own text is never overwritten.
  const applyImport = (imp: ImportedRecipe, by: ImportedBy) => {
    const merged = mergeImported(form, imp);
    setForm(merged.form);
    setPending(merged.pending);
    setImportNote({ summary: describeFilled(merged.filled), by });
    setErrors({});
    setImportOpen(false);
    setFocusTick((n) => n + 1);
  };

  const addPending = (what: 'ingredients' | 'steps') => {
    if (what === 'ingredients' && pending.ingredients) {
      const n = pending.ingredients.length;
      setForm(appendIngredients(form, pending.ingredients));
      setImportNote({ summary: `Added ${n} imported ${n === 1 ? 'ingredient' : 'ingredients'}. Review before saving.` });
    }
    if (what === 'steps' && pending.steps) {
      const n = pending.steps.length;
      setForm(appendSteps(form, pending.steps));
      setImportNote({ summary: `Added ${n} imported ${n === 1 ? 'step' : 'steps'}. Review before saving.` });
    }
    setPending((p) => ({ ...p, [what]: undefined }));
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
          <p className="cp-line">Fields marked <span aria-hidden="true">*</span><span className="sr-only">with an asterisk</span> are required.</p>
          {isNew && restored && (
            <p className="cp-note" role="status">
              We kept your unsaved draft from last time.
            </p>
          )}
          {isNew && (
            <button
              type="button" className="btn btn-prop cp-import-open" aria-expanded={importOpen} aria-controls="cp-import-panel"
              onClick={() => setImportOpen((o) => !o)}
            >
              Import a recipe
            </button>
          )}
          {isNew && (
            <div className="cp-importmsg" aria-live="polite">
              {importNote && <p className="cp-line">{importNote.summary}</p>}
              {importNote?.by && <p className="cp-note">{BY_LINE[importNote.by]}</p>}
              {pending.ingredients && (
                <button type="button" className="quiet" onClick={() => addPending('ingredients')}>Add the imported ingredients too</button>
              )}
              {pending.steps && (
                <button type="button" className="quiet" onClick={() => addPending('steps')}>Add the imported steps too</button>
              )}
            </div>
          )}
        </header>

        {isNew && importOpen && <ImportPanel onResult={applyImport} onClose={() => setImportOpen(false)} />}

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
            hint="Who made it for you, and when does it appear?"
            placeholder={importNote && blankText(form.story) ? 'Add why this dish matters to you' : undefined} onChange={(v) => patch({ story: v })}
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
            <TagsField tags={form.tags} onChange={(tags) => patch({ tags })} />
            <div className="cp-field">
              <label className="label" htmlFor="f-course">Course <span aria-hidden="true">*</span></label>
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
            <TextField id="f-serves" label="Serves" required type="number" inputMode="numeric" min={1} max={100} value={form.serves} errors={errors} hint="How many portions this makes" onChange={(v) => patch({ serves: v })} />
            <TextField id="f-makes" label="Makes" value={form.makes} errors={errors} hint="For example: 24 ladoos" onChange={(v) => patch({ makes: v })} />
            <TextField id="f-team" label="Team" value={form.team} errors={errors} onChange={(v) => patch({ team: v })} />
            <TextField id="f-city" label="City" value={form.city} errors={errors} onChange={(v) => patch({ city: v })} />
          </div>

          <fieldset className="cp-set">
            <legend className="label">Dietary notes</legend>
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
                  {DIETARY[d].label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="cp-set">
            <legend className="label">Main photo</legend>
            <PhotoField
              id="main" label="Add a main photo" slot={form.main} errors={errors}
              onFile={(file) => void upload({ kind: 'main' }, file, form.title.trim())}
              onAlt={(alt) => patch({ main: { ...form.main, alt } })}
              onRemove={() => patch({ main: emptySlot() })}
            />
          </fieldset>

          <fieldset className="cp-set">
            <legend className="label">Ingredients <span aria-hidden="true">*</span></legend>
            <ul className="cp-rows">
              {form.ingredients.map((ing, idx) => {
                const eid = `f-ing-${idx}`;
                const set = (p: Partial<typeof ing>) =>
                  patch({ ingredients: form.ingredients.map((x) => (x.key === ing.key ? { ...x, ...p } : x)) });
                return (
                  <li key={ing.key} className="cp-row cp-ing">
                    <div className="cp-qty">
                      <label className="label" htmlFor={`f-qty-${idx}`}><span className="sr-only">Ingredient {idx + 1} </span>Amount</label>
                      <input id={`f-qty-${idx}`} className="cp-input cp-hand" type="text" value={ing.quantity} onChange={(e) => set({ quantity: e.target.value })} />
                    </div>
                    <div className="cp-item">
                      <label className="label" htmlFor={eid}><span className="sr-only">Ingredient {idx + 1} </span>Ingredient</label>
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
            <button type="button" className="btn btn-prop" onClick={() => patch({ ingredients: [...form.ingredients, { key: newKey('i'), quantity: '', item: '' }] })}>
              Add an ingredient
            </button>
          </fieldset>

          <fieldset className="cp-set">
            <legend className="label">Steps <span aria-hidden="true">*</span></legend>
            <ol className="cp-rows cp-steps">
              {form.steps.map((step, idx) => {
                const sid = `f-step-${idx}`;
                const set = (p: Partial<typeof step>) =>
                  patch({ steps: form.steps.map((x) => (x.key === step.key ? { ...x, ...p } : x)) });
                return (
                  <li key={step.key} className="cp-row cp-step">
                    <div className="cp-stepmain">
                      <label className="label" htmlFor={sid}>Step {idx + 1}</label>
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
            <button type="button" className="btn btn-prop" onClick={() => patch({ steps: [...form.steps, { key: newKey('s'), text: '', slot: emptySlot() }] })}>
              Add a step
            </button>
          </fieldset>
        </div>

        <footer className="cp-foot">
          {saveFailed && <p className="cp-err" role="alert">Couldn&apos;t save. Your text is still here.</p>}
          {uploading && <p className="cp-note" role="status">Waiting for photos to finish uploading…</p>}
          <div className="cp-actions">
            <button type="submit" className="btn" disabled={saving || uploading}>
              {saving ? 'Saving…' : 'Save recipe'}
            </button>
            <a className="quiet" href={formatHash(cancelRoute)} onClick={goTo(cancelRoute)}>Cancel</a>
            {isNew && <button type="button" className="quiet" onClick={discardDraft}>Discard draft</button>}
          </div>
        </footer>
      </form>
    </Shell>
  );
}
