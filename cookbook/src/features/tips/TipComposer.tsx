import { useEffect, useId, useRef, useState } from 'react';
import { useStore } from '../../data/StoreProvider';
import type { Me, Photo, Tip } from '../../domain/types';
import { PHOTO_ACCEPT, PHOTO_HINT, PHOTO_PREPARING, photoErrorMessage } from '../../lib/image/messages';
import { preparePhoto } from '../../lib/image/prepare';
import { penFor } from '../recipe/pens';
import './tips.css';

export const TIP_MAX_CHARS = 600;

export interface TipComposerProps { recipeId: string; onDone: (tip: Tip) => void; onCancel: () => void }

export function TipComposer({ recipeId, onDone, onCancel }: TipComposerProps): JSX.Element {
  const store = useStore();
  const uid = useId();
  const [me, setMe] = useState<Me | null>(null);
  const [text, setText] = useState('');
  /** The photo after checking, HEIC conversion and resizing: what gets uploaded. */
  const [file, setFile] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(false);
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
        <button type="button" className="btn btn-prop" onClick={onCancel}>Close</button>
      </div>
    );
  }

  const pen = penFor(me.id);
  const textErrId = `${uid}-text-err`;
  const photoErrId = `${uid}-photo-err`;
  const photoHintId = `${uid}-photo-hint`;
  const countId = `${uid}-count`;
  const describedBy = [countId, textError ? textErrId : ''].filter(Boolean).join(' ');

  function requestCancel() {
    if (text.length > 0) setConfirming(true);
    else onCancel();
  }

  async function pickFile(f: File | null) {
    setPhotoError('');
    if (!f) return;
    setFile(null);
    setPreview(null);
    setPreparing(true);
    try {
      const ready = await preparePhoto(f);
      if (!alive.current) return;
      setFile(ready);
      let url: string | null = null;
      try {
        if (typeof URL.createObjectURL === 'function') url = URL.createObjectURL(ready);
      } catch {
        url = null; // the preview is a nicety; never let it block attaching the photo
      }
      setPreview(url);
    } catch (err) {
      if (alive.current) setPhotoError(photoErrorMessage(err));
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      if (alive.current) setPreparing(false);
    }
  }

  function removePhoto() {
    setFile(null);
    setPreview(null);
    setAlt('');
    setPhotoError('');
    if (fileRef.current) fileRef.current.value = '';
  }

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
        if (alive.current) {
          setBusy(false);
          setPhotoError(photoErrorMessage(err));
        }
        return;
      }
    }
    try {
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
      <label className="label label-ink" htmlFor={`${uid}-text`}>Your tip</label>
      <textarea
        id={`${uid}-text`}
        ref={areaRef}
        className={`tips-area pen-${pen}`}
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
        <label className="label label-ink" htmlFor={`${uid}-file`}>Photo (optional)</label>
        <input
          id={`${uid}-file`}
          ref={fileRef}
          className="tips-file"
          type="file"
          accept={PHOTO_ACCEPT}
          disabled={busy || preparing}
          aria-describedby={photoError ? `${photoHintId} ${photoErrId}` : photoHintId}
          aria-invalid={photoError && !file ? true : undefined}
          onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
        />
        <p id={photoHintId} className="tips-hint">{PHOTO_HINT}</p>
        {preparing && <p className="tips-note" role="status">{PHOTO_PREPARING}</p>}
        {file && (
          <div className="tips-attached">
            {preview && <img className="tips-preview" src={preview} alt="" />}
            <label className="label label-ink" htmlFor={`${uid}-alt`}>Describe the photo</label>
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
            <button type="button" className="quiet" onClick={removePhoto} disabled={busy}>Remove photo</button>
          </div>
        )}
        {photoError && <p id={photoErrId} className="tips-error" role="alert">{photoError}</p>}
      </div>

      {confirming ? (
        <div className="tips-confirm" role="group" aria-label="Discard this tip?">
          <p className="tips-note">Discard this tip?</p>
          <button type="button" className="btn btn-prop" onClick={onCancel}>Discard</button>
          <button type="button" className="quiet" autoFocus onClick={() => { setConfirming(false); areaRef.current?.focus(); }}>Keep writing</button>
        </div>
      ) : (
        <div className="tips-actions">
          <button type="submit" className="btn" disabled={busy || preparing}>{busy ? 'Pinning…' : 'Pin it to the card'}</button>
          <button type="button" className="quiet" onClick={requestCancel}>Cancel</button>
        </div>
      )}
    </form>
  );
}
