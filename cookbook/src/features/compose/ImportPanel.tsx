import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { PHOTO_ACCEPT, PHOTO_HINT, PHOTO_MESSAGES, PHOTO_PREPARING, photoErrorMessage } from '../../lib/image/messages';
import { preparePhoto } from '../../lib/image/prepare';
import { ImportError, importRecipe } from '../../lib/import';
import type { ImportedBy, ImportedRecipe, SampleFn } from '../../lib/import';

export const IMPORT_MESSAGES = {
  empty: 'Paste a recipe or choose a photo first.',
  photoNeedsClaude: 'Photo reading needs Claude access in claude.ai. Paste the text instead.',
  photoFailed: "Claude couldn't read that photo. Try a clearer one, or paste the text instead.",
  photoUnavailable: "Photo reading isn't available here. Paste the text instead.",
  photoTooBig: PHOTO_MESSAGES.tooLarge,
  nothingFound: "Couldn't find a recipe in that. Check what you pasted and try again.",
  generic: "Couldn't read that recipe. Paste the text and try again.",
} as const;

export const BY_LINE: Record<ImportedBy, string> = {
  claude: 'Filled in by Claude — check every field',
  local: "Filled in from the text's headings — check every field",
};

const SAMPLE_WAIT_MS = 3000;

/** The `sample` capability if this view has it, else null. Never throws, never waits long. */
async function resolveSample(): Promise<SampleFn | null> {
  const claude = (globalThis as { claude?: { use?: (name: string) => Promise<unknown> } }).claude;
  if (!claude || typeof claude.use !== 'function') return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const wait = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), SAMPLE_WAIT_MS);
    });
    const s = (await Promise.race([claude.use('sample'), wait])) as Partial<SampleFn> | null;
    return s && typeof s.json === 'function' && typeof s.limits === 'function' ? (s as SampleFn) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const PHOTO_ERROR_NAMES = new Set(['ImageTooLargeError', 'UnsupportedImageError', 'UnreadableImageError', 'HeicConversionError']);

function messageFor(err: unknown): string {
  if (err instanceof Error && PHOTO_ERROR_NAMES.has(err.name)) return photoErrorMessage(err);
  if (err instanceof ImportError) {
    switch (err.code) {
      case 'empty': return IMPORT_MESSAGES.empty;
      case 'photo_needs_claude': return IMPORT_MESSAGES.photoNeedsClaude;
      case 'photo_failed': return IMPORT_MESSAGES.photoFailed;
      case 'images_unavailable':
      case 'image_rejected': return IMPORT_MESSAGES.photoUnavailable;
      case 'no_recipe_found': return IMPORT_MESSAGES.nothingFound;
      default: return IMPORT_MESSAGES.generic;
    }
  }
  return IMPORT_MESSAGES.generic;
}

export default function ImportPanel(props: {
  onResult: (recipe: ImportedRecipe, by: ImportedBy) => void;
  onClose: () => void;
}): JSX.Element {
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [error, setError] = useState('');
  const [hasClaude, setHasClaude] = useState(false);
  const samplePromise = useRef<Promise<SampleFn | null> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const p = resolveSample();
    samplePromise.current = p;
    void p.then((s) => {
      if (mounted.current) setHasClaude(s !== null);
    });
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // The photo is checked and converted (HEIC to JPEG) as soon as it is picked, so a bad file is reported
  // here, next to the picker, and only a ready JPEG/PNG/WebP/GIF is ever kept for the import.
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setPhotoFailed(false);
    setImage(null);
    setPreparing(true);
    try {
      const ready = await preparePhoto(file);
      if (!mounted.current) return;
      setImage(new File([ready], file.name, { type: ready.type || file.type }));
    } catch (err) {
      if (mounted.current) {
        setError(photoErrorMessage(err));
        setPhotoFailed(true);
      }
    } finally {
      if (mounted.current) setPreparing(false);
    }
  };

  const run = async () => {
    if (busy || preparing) return;
    if (text.trim() === '' && !image) {
      setError(IMPORT_MESSAGES.empty);
      return;
    }
    setError('');
    setPhotoFailed(false);
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const sample = await (samplePromise.current ?? Promise.resolve(null));
      if (ac.signal.aborted) return;
      const r = await importRecipe({ sample, text, image: image ?? undefined, signal: ac.signal });
      if (ac.signal.aborted) return;
      props.onResult(r.recipe, r.by);
    } catch (err) {
      if (!ac.signal.aborted && mounted.current) setError(messageFor(err));
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      if (mounted.current) setBusy(false);
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    props.onClose();
  };

  return (
    <section className="cp-import" id="cp-import-panel" aria-labelledby="cp-import-h" aria-busy={busy ? true : undefined}>
      <h2 className="label label-ink" id="cp-import-h">Import from text or a photo</h2>
      <label className="cp-import-ask" htmlFor="f-import-text">
        Paste the recipe &mdash; from your notes, an email, or a copied web page
      </label>
      <textarea
        id="f-import-text"
        className="cp-input cp-area cp-import-text"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        aria-describedby="f-import-hint"
      />
      <p className="cp-hint" id="f-import-hint">From a web page: open the recipe page, select all, copy, and paste it here.</p>

      <div className="cp-import-photo">
        <input
          id="f-import-file"
          className="sr-only"
          type="file"
          accept={PHOTO_ACCEPT}
          capture="environment"
          onChange={(e) => void onFile(e)}
          disabled={busy || preparing}
          aria-describedby={photoFailed && error ? 'f-import-photo-hint f-import-err' : 'f-import-photo-hint'}
          aria-invalid={photoFailed && error ? true : undefined}
        />
        <label className="btn btn-prop cp-filebtn" htmlFor="f-import-file">Or use a photo of a recipe card</label>
        <p className="cp-hint" id="f-import-photo-hint">{PHOTO_HINT}</p>
        {preparing && <p className="cp-note" role="status">{PHOTO_PREPARING}</p>}
        {image && (
          <span className="cp-import-file">
            {image.name}{' '}
            <button type="button" className="quiet" onClick={() => setImage(null)} disabled={busy}>Remove photo</button>
          </span>
        )}
      </div>

      {hasClaude && <p className="cp-hint">Claude reads what you paste only to fill this form, using your Claude account.</p>}
      {error && <p className="cp-err" id="f-import-err" role="alert">{error}</p>}

      <div className="cp-actions">
        <button type="button" className="btn" onClick={() => void run()} disabled={busy || preparing}>
          {busy ? 'Reading…' : 'Fill in the form'}
        </button>
        <button type="button" className="quiet" onClick={cancel}>Cancel</button>
      </div>
    </section>
  );
}
