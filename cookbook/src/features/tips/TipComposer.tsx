import { useEffect, useId, useRef, useState } from 'react';
import { useStore } from '../../data/StoreProvider';
import type { Me, Photo, Tip } from '../../domain/types';
import { penFor } from '../recipe/pens';
import './tips.css';

export const TIP_MAX_CHARS = 600;
export const TIP_MAX_PHOTO_BYTES = 20 * 1024 * 1024;

export interface TipComposerProps { recipeId: string; onDone: (tip: Tip) => void; onCancel: () => void }

export function TipComposer({ recipeId, onDone, onCancel }: TipComposerProps): JSX.Element {
  const store = useStore();
  const uid = useId();
  const [me, setMe] = useState<Me | null>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [textError, setTextError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    store.me().then(
      (m) => { if (alive.current) setMe(m); },
      () => { if (alive.current) setMe({ id: '', canWrite: false, canModerate: false }); },
    );
    return () => { alive.current = false; };
  }, [store]);

  useEffect(() => { if (me?.canWrite) areaRef.current?.focus(); }, [me]);

  useEffect(() => () => {
    if (preview && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(preview);
  }, [preview]);

  if (!me) return <div className="tips-composer" aria-busy="true"><p className="tips-note">Getting the pen…</p></div>;

  if (!me.canWrite) {
    return (
      <div className="tips-composer">
        <p className="tips-note">Adding tips needs Contributor access.</p>
        <button type="button" className="tips-btn tips-btn-prop" onClick={onCancel}>Close</button>
      </div>
    );
  }

  const pen = penFor(me.id);
  const textErrId = `${uid}-text-err`;
  const photoErrId = `${uid}-photo-err`;
  const countId = `${uid}-count`;
  const describedBy = [countId, textError ? textErrId : ''].filter(Boolean).join(' ');

  function requestCancel() {
    if (text.length > 0) setConfirming(true);
    else onCancel();
  }

  function pickFile(f: File | null) {
    setPhotoError('');
    if (!f) return;
    if (f.size > TIP_MAX_PHOTO_BYTES) {
      setPhotoError('That photo is over 20 MB. Pick a smaller one.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setFile(f);
    let url: string | null = null;
    try {
      if (typeof URL.createObjectURL === 'function') url = URL.createObjectURL(f);
    } catch {
      url = null; // the preview is a nicety; never let it block attaching the photo
    }
    setPreview(url);
  }

  function removePhoto() {
    setFile(null);
    setPreview(null);
    setAlt('');
    setPhotoError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function submit() {
    if (busy) return;
    const body = text.trim();
    setTextError('');
    setPhotoError('');
    if (!body) { setTextError('Write something first.'); areaRef.current?.focus(); return; }
    if (file && !alt.trim()) { setPhotoError('Describe the photo for people who cannot see it.'); return; }
    setBusy(true);
    try {
      let photo: Photo | undefined;
      if (file) photo = await store.uploadPhoto(file, alt.trim());
      const tip = await store.addTip(recipeId, { text: body, photo });
      if (alive.current) setBusy(false);
      onDone(tip);
    } catch {
      if (alive.current) {
        setBusy(false);
        setTextError("Couldn't pin your tip. It's still here.");
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (busy) return; // no cancelling mid-save
      if (confirming) setConfirming(false);
      else requestCancel();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <form
      className="tips-composer"
      aria-label="Add your tip"
      noValidate
      onKeyDown={onKeyDown}
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
    >
      <label className="tips-label" htmlFor={`${uid}-text`}>Your tip</label>
      <textarea
        id={`${uid}-text`}
        ref={areaRef}
        className={`tips-area tips-pen-${pen}`}
        rows={5}
        value={text}
        maxLength={TIP_MAX_CHARS}
        onChange={(e) => setText(e.target.value.slice(0, TIP_MAX_CHARS))}
        aria-describedby={describedBy}
        aria-invalid={textError ? true : undefined}
        disabled={busy}
      />
      <p id={countId} className="tips-count">{text.length} / {TIP_MAX_CHARS}</p>
      {textError && <p id={textErrId} className="tips-error" role="alert">{textError}</p>}

      <div className="tips-photo">
        <label className="tips-label" htmlFor={`${uid}-file`}>Photo (optional)</label>
        <input
          id={`${uid}-file`}
          ref={fileRef}
          className="tips-file"
          type="file"
          accept="image/*"
          disabled={busy}
          aria-describedby={photoError ? photoErrId : undefined}
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        {file && (
          <div className="tips-attached">
            {preview && <img className="tips-preview" src={preview} alt="" />}
            <label className="tips-label" htmlFor={`${uid}-alt`}>Describe the photo</label>
            <input
              id={`${uid}-alt`}
              className="tips-alt"
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              aria-required="true"
              disabled={busy}
              aria-describedby={photoError ? photoErrId : undefined}
            />
            <button type="button" className="tips-quiet" onClick={removePhoto} disabled={busy}>Remove photo</button>
          </div>
        )}
        {photoError && <p id={photoErrId} className="tips-error" role="alert">{photoError}</p>}
      </div>

      {confirming ? (
        <div className="tips-confirm" role="group" aria-label="Discard this tip?">
          <p className="tips-note">Discard this tip?</p>
          <button type="button" className="tips-btn tips-btn-prop" onClick={onCancel}>Discard</button>
          <button type="button" className="tips-quiet" autoFocus onClick={() => { setConfirming(false); areaRef.current?.focus(); }}>Keep writing</button>
        </div>
      ) : (
        <div className="tips-actions">
          <button type="submit" className="tips-btn" disabled={busy}>{busy ? 'Pinning…' : 'Pin it to the card'}</button>
          <button type="button" className="tips-quiet" onClick={requestCancel}>Cancel</button>
        </div>
      )}
    </form>
  );
}
