import { useEffect, useId, useRef, useState } from 'react';
import { useStore } from '../../data/StoreProvider';
import type { MadeNote, Photo } from '../../domain/types';
import { PHOTO_ACCEPT, PHOTO_HINT, PHOTO_PREPARING, photoErrorMessage } from '../../lib/image/messages';
import { TIP_MAX_CHARS } from '../tips/TipComposer';
import { usePhotoPicker } from '../tips/usePhotoPicker';
import { MADE_COMPOSER_ID } from './handoff';
import './made.css';

export const MADE_PLACEHOLDER = 'I made this — here’s what I found…';

export interface MadeComposerProps { recipeId: string; onDone: (note: MadeNote) => void }

/** The "I made this" composer: text plus an optional photo, using the same photo flow and messages as tips. */
export function MadeComposer({ recipeId, onDone }: MadeComposerProps): JSX.Element {
  const store = useStore();
  const uid = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [textError, setTextError] = useState('');
  const { file, preparing, preview, alt, setAlt, photoError, setPhotoError, fileRef, pickFile, removePhoto } = usePhotoPicker();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const textErrId = `${uid}-text-err`;
  const photoErrId = `${uid}-photo-err`;
  const photoHintId = `${uid}-photo-hint`;
  const countId = `${uid}-count`;

  async function submit() {
    if (busy || preparing) return;
    const body = text.trim();
    setTextError('');
    setPhotoError('');
    if (!body) { setTextError('Write something first.'); areaRef.current?.focus(); return; }
    if (file && !alt.trim()) { setPhotoError('Describe the photo for people who cannot see it.'); return; }
    setBusy(true);
    let photo: Photo | undefined;
    if (file) {
      try {
        photo = await store.uploadPhoto(file, alt.trim());
      } catch (err) {
        if (alive.current) { setBusy(false); setPhotoError(photoErrorMessage(err)); }
        return;
      }
    }
    try {
      const note = await store.addMade(recipeId, { text: body, photo });
      if (alive.current) {
        setBusy(false);
        setText('');
        removePhoto();
      }
      onDone(note);
    } catch {
      if (alive.current) {
        setBusy(false);
        setTextError("Couldn't post that. It's still here.");
      }
    }
  }

  return (
    <form
      id={MADE_COMPOSER_ID}
      className="mk-composer"
      aria-label="Tell us how it went"
      noValidate
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
    >
      <label className="label label-ink" htmlFor={`${uid}-text`}>How did it go?</label>
      <textarea
        id={`${uid}-text`}
        ref={areaRef}
        className="mk-area"
        rows={5}
        value={text}
        placeholder={MADE_PLACEHOLDER}
        maxLength={TIP_MAX_CHARS}
        onChange={(e) => setText(e.target.value.slice(0, TIP_MAX_CHARS))}
        aria-describedby={textError ? `${countId} ${textErrId}` : countId}
        aria-invalid={textError ? true : undefined}
        disabled={busy}
      />
      <p id={countId} className="mk-hint">{text.length} / {TIP_MAX_CHARS}</p>
      {textError && <p id={textErrId} className="mk-error" role="alert">{textError}</p>}

      <label className="label label-ink" htmlFor={`${uid}-file`}>Photo (optional)</label>
      <input
        id={`${uid}-file`}
        ref={fileRef}
        className="mk-file"
        type="file"
        accept={PHOTO_ACCEPT}
        disabled={busy || preparing}
        aria-describedby={photoError ? `${photoHintId} ${photoErrId}` : photoHintId}
        aria-invalid={photoError && !file ? true : undefined}
        onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
      />
      <p id={photoHintId} className="mk-hint">{PHOTO_HINT}</p>
      {preparing && <p className="mk-hint" role="status">{PHOTO_PREPARING}</p>}
      {file && (
        <div className="mk-attached">
          {preview && <img className="mk-preview" src={preview} alt="" />}
          <label className="label label-ink" htmlFor={`${uid}-alt`}>Describe the photo</label>
          <input
            id={`${uid}-alt`}
            className="mk-alt"
            type="text"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            aria-required="true"
            disabled={busy}
            aria-describedby={photoError ? photoErrId : undefined}
          />
          <button type="button" className="quiet" onClick={removePhoto} disabled={busy}>Remove photo</button>
        </div>
      )}
      {photoError && <p id={photoErrId} className="mk-error" role="alert">{photoError}</p>}

      <div className="mk-actions">
        <button type="submit" className="btn" disabled={busy || preparing}>{busy ? 'Posting…' : 'Post it'}</button>
      </div>
    </form>
  );
}
