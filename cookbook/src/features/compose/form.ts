import type { Course, DietaryTag, Photo, Recipe, RecipeDraft } from '../../domain/types';

/** One photo slot (main photo or a step photo) and where it is in its upload. */
export interface PhotoSlot {
  photo?: Photo;
  alt: string;
  status: 'idle' | 'uploading' | 'error';
  error?: string;
}

export interface IngredientRow { key: string; quantity: string; item: string }
export interface StepRow { key: string; text: string; slot: PhotoSlot }

export interface FormState {
  title: string;
  story: string;
  origin: string;
  occasions: string;
  course: Course | '';
  dietary: DietaryTag[];
  team: string;
  city: string;
  serves: string;
  makes: string;
  minutes: string;
  ingredients: IngredientRow[];
  steps: StepRow[];
  main: PhotoSlot;
}

export type Errors = Record<string, string>;

export const emptySlot = (): PhotoSlot => ({ alt: '', status: 'idle' });

let keyCounter = 0;
export function newKey(prefix: string): string {
  keyCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${keyCounter}`;
}

export function blankForm(): FormState {
  return {
    title: '', story: '', origin: '', occasions: '', course: '', dietary: [], team: '', city: '', serves: '', makes: '', minutes: '',
    ingredients: [{ key: newKey('i'), quantity: '', item: '' }],
    steps: [{ key: newKey('s'), text: '', slot: emptySlot() }],
    main: emptySlot(),
  };
}

function slotFrom(photo?: Photo): PhotoSlot {
  return photo ? { photo, alt: photo.alt, status: 'idle' } : emptySlot();
}

export function formFromRecipe(r: Recipe): FormState {
  return {
    title: r.title,
    story: r.story,
    origin: r.origin,
    occasions: r.occasions.join(', '),
    course: r.course,
    dietary: [...r.dietary],
    team: r.team ?? '',
    city: r.city ?? '',
    serves: r.serves === undefined ? '' : String(r.serves),
    makes: r.makes ?? '',
    minutes: r.totalMinutes === undefined ? '' : String(r.totalMinutes),
    ingredients: r.ingredients.length
      ? r.ingredients.map((i) => ({ key: newKey('i'), quantity: i.quantity, item: i.item }))
      : [{ key: newKey('i'), quantity: '', item: '' }],
    steps: r.steps.length
      ? r.steps.map((s) => ({ key: s.id, text: s.text, slot: slotFrom(s.photo) }))
      : [{ key: newKey('s'), text: '', slot: emptySlot() }],
    main: slotFrom(r.mainPhoto),
  };
}

export function splitList(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter((x) => x.length > 0);
}

const blank = (s: string) => s.trim().length === 0;

export function validate(f: FormState): Errors {
  const e: Errors = {};
  if (blank(f.title)) e['f-title'] = 'Give the recipe a title.';
  if (blank(f.story)) e['f-story'] = 'Tell the story behind this dish.';
  if (blank(f.origin)) e['f-origin'] = 'Say which culture or region it comes from.';
  if (f.course === '') e['f-course'] = 'Choose a course.';
  const sv = f.serves.trim();
  if (!/^[0-9]+$/.test(sv) || Number(sv) < 1 || Number(sv) > 100) e['f-serves'] = 'Say how many portions this makes, a whole number from 1 to 100.';
  const m = f.minutes.trim();
  if (m !== '' && !/^[1-9][0-9]*$/.test(m)) e['f-minutes'] = 'Use a whole number of minutes, like 45, or leave it empty.';

  const ings = f.ingredients.filter((i) => !(blank(i.quantity) && blank(i.item)));
  if (ings.length === 0) e['f-ing-0'] = 'Add at least one ingredient.';
  f.ingredients.forEach((i, idx) => {
    if (blank(i.item) && !blank(i.quantity)) e[`f-ing-${idx}`] = 'Name the ingredient that goes with this amount.';
  });

  const steps = f.steps.filter((s) => !(blank(s.text) && !s.slot.photo));
  if (steps.length === 0) e['f-step-0'] = 'Add at least one step.';
  f.steps.forEach((s, idx) => {
    if (blank(s.text) && s.slot.photo) e[`f-step-${idx}`] = 'Write what happens in this step.';
    if (s.slot.photo && blank(s.slot.alt)) e[`f-alt-s-${idx}`] = 'Describe this photo for people who cannot see it.';
  });
  if (f.main.photo && blank(f.main.alt)) e['f-alt-main'] = 'Describe this photo for people who cannot see it.';
  return e;
}

function withAlt(slot: PhotoSlot): Photo | undefined {
  return slot.photo ? { ...slot.photo, alt: slot.alt.trim() } : undefined;
}

/** Build the store draft from a form that already passed validate(). Empty rows are dropped. */
export function toDraft(f: FormState, loaded?: Recipe): RecipeDraft {
  const draft: RecipeDraft = {
    title: f.title.trim(),
    story: f.story.trim(),
    origin: f.origin.trim(),
    occasions: splitList(f.occasions),
    course: f.course as Course,
    dietary: f.dietary,
    ingredients: f.ingredients
      .filter((i) => !(blank(i.quantity) && blank(i.item)))
      .map((i) => ({ quantity: i.quantity.trim(), item: i.item.trim() })),
    steps: f.steps
      .filter((s) => !(blank(s.text) && !s.slot.photo))
      .map((s) => {
        const photo = withAlt(s.slot);
        return photo ? { id: s.key, text: s.text.trim(), photo } : { id: s.key, text: s.text.trim() };
      }),
  };
  if (!blank(f.team)) draft.team = f.team.trim();
  if (!blank(f.city)) draft.city = f.city.trim();
  draft.serves = Number(f.serves.trim());
  if (!blank(f.makes)) draft.makes = f.makes.trim();
  if (f.minutes.trim() !== '') draft.totalMinutes = Number(f.minutes.trim());
  const main = withAlt(f.main);
  if (main) draft.mainPhoto = main;
  if (loaded?.hidden !== undefined) draft.hidden = loaded.hidden;
  if (loaded?.sample !== undefined) draft.sample = loaded.sample;
  return draft;
}

export function isUploading(f: FormState): boolean {
  return f.main.status === 'uploading' || f.steps.some((s) => s.slot.status === 'uploading');
}

// ---- unsaved new-recipe draft (text only, never photos) ----

export const DRAFT_KEY = 'ace-culture-cookbook:compose-draft:v1';

interface StoredDraft extends Omit<FormState, 'steps' | 'main'> {
  steps: { key: string; text: string }[];
}

export function loadStoredDraft(): FormState | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as StoredDraft;
    const base = blankForm();
    return {
      ...base,
      ...d,
      ingredients: d.ingredients?.length ? d.ingredients : base.ingredients,
      steps: d.steps?.length ? d.steps.map((s) => ({ key: s.key, text: s.text, slot: emptySlot() })) : base.steps,
      main: emptySlot(),
    };
  } catch {
    return null;
  }
}

export function isBlankForm(f: FormState): boolean {
  return (
    [f.title, f.story, f.origin, f.occasions, f.team, f.city, f.serves, f.makes, f.minutes].every(blank) &&
    f.course === '' &&
    f.dietary.length === 0 &&
    f.ingredients.every((i) => blank(i.quantity) && blank(i.item)) &&
    f.steps.every((s) => blank(s.text))
  );
}

export function storeDraft(f: FormState): void {
  try {
    if (isBlankForm(f)) {
      window.localStorage.removeItem(DRAFT_KEY);
      return;
    }
    const d: StoredDraft = { ...f, steps: f.steps.map((s) => ({ key: s.key, text: s.text })) };
    delete (d as Partial<FormState>).main;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // storage unavailable: the draft just won't survive a reload
  }
}

export function clearStoredDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
